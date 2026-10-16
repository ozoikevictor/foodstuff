import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const filenames = [
  "c-rice.jpg", "c-beans.jpg", "c-meat.jpg", "c-fish.jpg", "c-veg.jpg",
  "c-fruits.jpg", "c-yam.jpg", "c-oil.jpg", "c-spices.jpg", "c-frozen.jpg",
  "c-provisions.jpg", "c-wholesale.jpg", "r-jollof.jpg", "r-fried.jpg",
  "r-egusi.jpg", "r-ogbono.jpg", "r-oha.jpg", "r-beans.jpg", "r-yam.jpg", "r-pepper.jpg",
];
const artwork = new Map(filenames.map(filename => {
  const hash = createHash("sha256").update(filename).digest("hex");
  const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
  return [id, new URL(`./public/catalogue/${filename}`, import.meta.url)];
}));

export function publicArtwork(upload) {
  if (upload.private) return null;
  const file = artwork.get(upload.id);
  return file ? readFileSync(file) : null;
}
