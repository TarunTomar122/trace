import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { APP_ICON_MASTER, APPLE_TOUCH_ICON, WEB_APP_ICONS } from "./app-icons.ts";

const frontendDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(frontendDir, "public");
const expectedDigests = {
  "trace-app-icon-v1-1024.png": "e20407695938900fbd99c19e838f3850c46201a986965aa77e965399c790bb61",
  "trace-app-icon-v1-180.png": "8e931f4b998fd6c8510d71af36fa1a54a3866cda7442233ce6771ce2a8af33e3",
  "trace-app-icon-v1-192.png": "16291590bfc962b593dd82f3b6c06d92b5dcdb4dd9ba7cf99a56111a910bac40",
  "trace-app-icon-v1-512.png": "4ea4202f6e88e6b6a4c2284708f763d83c6dc674042849045ba8ed212459c45b",
};

function readPng(name) {
  const bytes = readFileSync(join(publicDir, name));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(bytes.subarray(0, 8).equals(signature), `${name} must be a PNG`);

  const chunkTypes = new Set();
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    chunkTypes.add(bytes.toString("ascii", offset + 4, offset + 8));
    offset += 12 + length;
  }

  const colorType = bytes[25];
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    hasTransparency: colorType === 4 || colorType === 6 || chunkTypes.has("tRNS"),
  };
}

test("PWA manifest declares correctly sized opaque icons", () => {
  const manifest = JSON.parse(readFileSync(join(publicDir, "site.webmanifest"), "utf8"));
  const expected = WEB_APP_ICONS.map(({ url, ...icon }) => ({
    src: url,
    ...icon,
    purpose: "any",
  }));

  assert.deepEqual(manifest.icons, expected);
  for (const icon of expected) {
    const size = Number.parseInt(icon.sizes, 10);
    assert.deepEqual(readPng(icon.src.slice(1)), {
      width: size,
      height: size,
      hasTransparency: false,
    });
  }
});

test("Apple touch metadata uses a dedicated opaque 180px icon", () => {
  assert.deepEqual(APPLE_TOUCH_ICON, {
    url: "/trace-app-icon-v1-180.png",
    type: "image/png",
    sizes: "180x180",
  });
  assert.deepEqual(readPng(APPLE_TOUCH_ICON.url.slice(1)), {
    width: 180,
    height: 180,
    hasTransparency: false,
  });
});

test("versioned icon artwork stays cream, monochrome, and complete", () => {
  const icons = [APP_ICON_MASTER, APPLE_TOUCH_ICON, ...WEB_APP_ICONS];
  for (const icon of icons) {
    const name = icon.url.slice(1);
    const size = Number.parseInt(icon.sizes, 10);
    const bytes = readFileSync(join(publicDir, name));

    assert.deepEqual(readPng(name), { width: size, height: size, hasTransparency: false });
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedDigests[name]);
  }

  const favicon = readFileSync(join(frontendDir, "app", "favicon.ico"));
  assert.equal(
    createHash("sha256").update(favicon).digest("hex"),
    "01dc043f6ba8a67fb65563dd3862132641a7e0b7645cea35672d9cf418e07c2f",
  );
});
