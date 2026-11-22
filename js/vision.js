import { FaceLandmarker, FilesetResolver } from
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
  import { head } from "./shared.js";

const label = document.getElementById("label");
const debug = document.getElementById("debug");
const video = document.getElementById("video");

// ---- Tuning numbers: change these if it feels too strict or too loose ----
const EYES_CLOSED_ABOVE = 0.5;   // blink score above this = eyes closed
const HEAD_TO_EYE = 2.5;         // how much a head turn counts vs eye movement
const EYE_SIGN = -1;             // flip to 1 if the side eye behaves worse
const GAZE_LIMIT = 0.35;         // how far the combined gaze can be off-centre
const YAW_MAX = 0.4;             // hard limit: head turned too far is always "away"
const FRAMES_TO_LOSE_WATCH = 6;  // about 0.2s at 30fps (ignores normal blinks)

// ---- Load the face model ----
const fileset = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
);
const faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
  baseOptions: {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  },
  runningMode: "VIDEO",
  numFaces: 1,
  outputFaceBlendshapes: true,   // gives us eye-closed and eye-direction scores
});

// ---- Turn on the camera ----
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
video.srcObject = stream;
await video.play();

// ---- Detect a covered camera (a very dark or completely flat picture) ----
const DARK_BELOW = 45;           // average brightness (0 to 255) below this = dark
const FLAT_BELOW = 12;           // picture detail below this = flat (a hand or finger on the lens)
const COVER_FRAMES = 10;         // frames in a row before we believe it (about 0.3s)
const probe = document.createElement("canvas");
probe.width = 32;
probe.height = 24;
const probeCtx = probe.getContext("2d", { willReadFrequently: true });
let coverFrames = 0;

function measurePicture() {
  probeCtx.drawImage(video, 0, 0, 32, 24);                  // a tiny copy of the camera picture
  const px = probeCtx.getImageData(0, 0, 32, 24).data;
  const n = px.length / 4;
  let sum = 0, sumSq = 0;
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;   // brightness of this pixel
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / n;                                     // how bright the picture is
  const detail = Math.sqrt(Math.max(0, sumSq / n - mean * mean));   // how much variety it has
  return { mean, detail };
}

let watched = true;              // the page starts frozen
let previousWatched = null;      // used to spot when the state changes
let notLookingFrames = 0;
let lastTime = -1;

// ---- Decide if the user is looking at the screen ----
function isLookingAtScreen(result) {
    if (result.faceLandmarks.length === 0) {
    head.seen = false;                                  // lost the face
    return { looking: false, info: "no face" };
  }

  // Turn the blendshape list into a simple lookup: { eyeBlinkLeft: 0.02, ... }
  const s = {};
  for (const c of result.faceBlendshapes[0].categories) s[c.categoryName] = c.score;

  const blink = (s.eyeBlinkLeft + s.eyeBlinkRight) / 2;

  // Signed eye direction: negative = looking one way, positive = the other
  const lookLeft = (s.eyeLookOutLeft + s.eyeLookInRight) / 2;
  const lookRight = (s.eyeLookInLeft + s.eyeLookOutRight) / 2;
  const eyeX = (lookRight - lookLeft) * EYE_SIGN;

  // Head turn: where the nose sits between the two sides of the face
  const lm = result.faceLandmarks[0];
  const nose = lm[1], leftSide = lm[234], rightSide = lm[454];
  head.seen = true;
  head.x = 0.5 - nose.x;     // positive = your head is to the right of the screen centre
  head.y = nose.y - 0.5;     // positive = your head is lower in the picture
  const yaw = (nose.x - leftSide.x) / (rightSide.x - leftSide.x) - 0.5;

  // Head and eyes added together: if they cancel out, you're still looking at the screen
  const gaze = yaw * HEAD_TO_EYE + eyeX;

  const eyesOpen = blink < EYES_CLOSED_ABOVE;
  const gazeForward = Math.abs(gaze) < GAZE_LIMIT;
  const headNotTooFar = Math.abs(yaw) < YAW_MAX;

  return {
    looking: eyesOpen && gazeForward && headNotTooFar,
    info: `blink ${blink.toFixed(2)} | yaw ${yaw.toFixed(2)} | eyeX ${eyeX.toFixed(2)} | gaze ${gaze.toFixed(2)}`,
  };
}

// ---- Check every frame ----
function loop() {
  if (video.currentTime !== lastTime) {
    lastTime = video.currentTime;
    const result = faceLandmarker.detectForVideo(video, performance.now());
    const { looking, info } = isLookingAtScreen(result);
    // Is the camera covered? (no face, and the picture is dark or flat)
    const pic = measurePicture();
    const maybeCovered = !head.seen && (pic.mean < DARK_BELOW || pic.detail < FLAT_BELOW);
    coverFrames = maybeCovered ? coverFrames + 1 : 0;
    const covered = coverFrames >= COVER_FRAMES;
    if (covered !== head.covered) {
      head.covered = covered;
      window.dispatchEvent(new CustomEvent("coverchange", { detail: { covered } }));
    }

    if (looking) {
      watched = true;            // instant: freeze the moment you look back
      notLookingFrames = 0;
    } else {
      notLookingFrames++;        // slow: ignore normal blinks
      if (notLookingFrames >= FRAMES_TO_LOSE_WATCH) watched = false;
    }

    // Tell the rest of the page when the state changes
    if (watched !== previousWatched) {
      previousWatched = watched;
      window.dispatchEvent(new CustomEvent("watchedchange", { detail: { watched } }));
    }

    label.textContent = watched ? "WATCHED" : "NOT WATCHED";
    debug.textContent = `${info} | light ${pic.mean.toFixed(0)} detail ${pic.detail.toFixed(0)}`;
  }
  requestAnimationFrame(loop);
}
loop();