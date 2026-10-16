import { test } from "node:test";
import assert from "node:assert/strict";
import { publicArtwork } from "./public-artwork.mjs";

test("existing catalogue image IDs resolve to bundled JPEGs after deployment", () => {
  const bytes = publicArtwork({ id: "2c65bef1-5f36-a399-5810-9e5661dd169a", private: false });
  assert.ok(bytes?.length > 0);
  assert.equal(bytes[0], 255);
  assert.equal(bytes[1], 216);
});
test("private and unknown image IDs never use the public artwork fallback", () => {
  assert.equal(publicArtwork({ id: "2c65bef1-5f36-a399-5810-9e5661dd169a", private: true }), null);
  assert.equal(publicArtwork({ id: "../../.env", private: false }), null);
});
