/** True while the user drags the rotate anchor (icons keep their scale). */
let rotating = false

export function beginRotateTransform() {
  rotating = true
}

export function endRotateTransform() {
  rotating = false
}

/** Read once when an icon finishes transform — survives transformer/node event order. */
export function isRotateTransform() {
  return rotating
}

export function consumeRotateTransform() {
  const v = rotating
  rotating = false
  return v
}
