import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryPool, isAudioPresentation, VISITOR_MEDIA_KIND } from "../src/data/memoryPool.js";
import { matchesVisitorFile } from "../src/data/visitorAttachments.js";
import { getMemoryCardViewModel } from "../src/memory/MemoryCardRenderer.js";

test("the local picker matches media types and falls back to file extensions for untyped recordings", () => {
  assert.ok(matchesVisitorFile({ type: "", name: "片段.MOV", size: 12 }, "video"));
  assert.ok(matchesVisitorFile({ type: "application/octet-stream", name: "录音.m4a", size: 16 }, "audio"));
  assert.ok(matchesVisitorFile({ type: "image/jpeg", name: "珍藏", size: 10 }, "image"));
  assert.equal(matchesVisitorFile({ type: "audio/mpeg", name: "clip.jpg", size: 10 }, "image"), false);
  assert.equal(matchesVisitorFile({ type: "image/png", name: "blank.png", size: 0 }, "image"), false);
});

test("visitor media can stand alone or keep its exact caption and filename in both languages", () => {
  const pool = createMemoryPool();
  for (const kind of ["image", "audio", "video"]) {
    const attachment = { kind, url: "blob:test/" + kind, name: "我的 " + kind, size: 15 };
    const text = kind === "audio" ? "" : "  江东门\n午后  ";
    const memory = pool.addSessionMemory(text, attachment);
    assert.equal(memory.kind, VISITOR_MEDIA_KIND);
    assert.ok(Object.isFrozen(memory.attachment));
    for (const lang of ["zh-CN", "en"]) {
      const view = getMemoryCardViewModel(memory, null, lang);
      assert.equal(view.text, text);
      assert.deepEqual(view.attachment, attachment);
      assert.equal(view.hasAudio, false);
      assert.equal(view.isVerifiedPair, false);
      assert.equal(view.label, lang === "en" ? "YOUR MEMORY" : "你的记忆");
    }
  }
  assert.throws(() => pool.addSessionMemory("  "));
  assert.throws(() => pool.addSessionMemory("caption", { kind: "image", name: "external.jpg", size: 5, url: "https://example.org/file" }));
  assert.equal(pool.sessionMemories.length, 3);
});

test("local recordings belong to their place’s visitor selection and never enter archive voice playback", () => {
  const pool = createMemoryPool({ prototypeMemories: [] });
  const otherPlace = createMemoryPool({ prototypeMemories: [] });
  const memory = pool.addSessionMemory("", { kind: "audio", name: "river.wav", size: 32, url: "blob:test/river" });
  assert.equal(pool.getById(memory.id), memory);
  assert.equal(otherPlace.getById(memory.id), null);
  assert.equal(pool.selectVisualEcho(), memory);
  assert.equal(isAudioPresentation(memory), false);
  assert.equal(pool.selectArchiveVoice(), null);
});
