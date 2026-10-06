import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';

const TASKS_VERSION = '1.0.1';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

export function createFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`,
    ).then((fileset) => FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }));
  }
  return landmarkerPromise;
}

const distance = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Keep this feature order aligned with backend/data/generate_dataset.py. */
export function extractFaceFeatures(
  landmarks: NormalizedLandmark[] | undefined,
  width: number,
  height: number,
): number[] | null {
  if (!landmarks || landmarks.length < 468 || width <= 0 || height <= 0) return null;
  const points: Array<[number, number]> = landmarks.map((point) => [point.x * width, point.y * height]);
  const leftWidth = Math.max(distance(points[33], points[133]), 1e-6);
  const rightWidth = Math.max(distance(points[362], points[263]), 1e-6);
  const leftEar = (distance(points[160], points[144]) + distance(points[158], points[153])) / (2 * leftWidth);
  const rightEar = (distance(points[385], points[380]) + distance(points[387], points[373])) / (2 * rightWidth);
  const avgEar = (leftEar + rightEar) / 2;
  const mouthWidth = Math.max(distance(points[78], points[308]), 1e-6);
  const mar = distance(points[13], points[14]) / mouthWidth;
  const eyeMid: [number, number] = [(points[33][0] + points[263][0]) / 2, (points[33][1] + points[263][1]) / 2];
  const faceHeight = Math.max(points[152][1] - eyeMid[1], 1e-6);
  const eyeSpan = Math.max(points[263][0] - points[33][0], 1e-6);
  const leftIris = points[468] ?? [(points[33][0] + points[133][0]) / 2, (points[33][1] + points[133][1]) / 2];
  const rightIris = points[473] ?? [(points[362][0] + points[263][0]) / 2, (points[362][1] + points[263][1]) / 2];
  const leftBrowGap = distance(points[105], points[159]) / leftWidth;
  const rightBrowGap = distance(points[334], points[386]) / rightWidth;
  const eyeLineAngle = Math.atan2(points[263][1] - points[33][1], eyeSpan);
  const noseCenterOffset = (points[1][0] - eyeMid[0]) / eyeSpan;
  const noseYRatio = (points[1][1] - eyeMid[1]) / faceHeight;

  return [
    leftEar,
    rightEar,
    avgEar,
    mar,
    1 - Math.min(leftBrowGap * 0.5, 1),
    1 - Math.min(rightBrowGap * 0.5, 1),
    Math.abs(eyeLineAngle),
    Math.abs(noseCenterOffset),
    noseYRatio,
    0.1 + 0.8 * clamp01((leftIris[0] - points[33][0]) / eyeSpan),
    clamp01((leftIris[1] - eyeMid[1]) / faceHeight + 0.48),
    0.1 + 0.8 * clamp01((rightIris[0] - points[33][0]) / eyeSpan),
    clamp01((rightIris[1] - eyeMid[1]) / faceHeight + 0.48),
    mar,
    leftEar * 2.5,
    rightEar * 2.5,
    (points[78][0] - points[33][0]) / eyeSpan,
    (points[308][0] - points[33][0]) / eyeSpan,
    1 - Math.min((leftBrowGap + rightBrowGap) * 0.25, 1),
    noseYRatio,
  ].map(clamp01);
}
