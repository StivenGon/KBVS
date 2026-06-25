import assert from "node:assert/strict";

import {
  buildTypingTextMatch,
  calculatePlayerStats,
  getCorrectPrefixLength,
  isTypingComplete,
  normalizeTypingInput,
} from "../src/lib/typing-room";

function test(name: string, run: () => void) {
  run();
  console.log(`ok - ${name}`);
}

test("continues matching after a missing dot", () => {
  const target = "Hola. mundo";
  const input = "Hola mundo";
  const match = buildTypingTextMatch(input, target);

  assert.equal(getCorrectPrefixLength(input, target), 4);
  assert.ok(match.correctCharacters > 4);
  assert.equal(match.mistakes, 1);
  assert.equal(match.complete, false);
});

test("continues matching after a missing space after a bracket", () => {
  const target = "Cierra el bloque (listo) y sigue";
  const input = "Cierra el bloque (listo)y sigue";
  const match = buildTypingTextMatch(input, target);

  assert.equal(match.mistakes, 1);
  assert.equal(match.correctCharacters, match.targetCharacters - 1);
  assert.equal(match.complete, false);
});

test("tracks extra punctuation without freezing later matches", () => {
  const target = "Final. ahora";
  const input = "Final.. ahora";
  const match = buildTypingTextMatch(input, target);

  assert.equal(match.mistakes, 1);
  assert.equal(match.correctCharacters, match.targetCharacters);
  assert.equal(match.complete, false);
});

test("tracks a wrong letter and resumes matching", () => {
  const target = "mecanografía";
  const input = "mezanografía";
  const match = buildTypingTextMatch(input, target);
  const targetTokens = match.tokens.filter((token) => token.kind === "target");

  assert.equal(match.mistakes, 1);
  assert.equal(targetTokens.at(-1)?.status, "correct");
  assert.equal(match.complete, false);
});

test("normalizes composed accents and smart punctuation", () => {
  const target = "Café: \"listo\".";
  const input = "Cafe\u0301: “listo”.";
  const match = buildTypingTextMatch(input, target);

  assert.equal(match.complete, true);
  assert.equal(match.mistakes, 0);
  assert.equal(isTypingComplete(input, target), true);
});

test("normalizes whitespace without allowing mistaken completion", () => {
  const target = "Hola. mundo";
  const input = normalizeTypingInput("Hola\n\tmundo", target);
  const stats = calculatePlayerStats(input, target, 0, 10_000, null);

  assert.equal(input, "Hola mundo");
  assert.ok(stats.progress > 4);
  assert.ok(stats.progress < 100);
  assert.equal(isTypingComplete(input, target), false);
});

test("only exact normalized text reaches 100 percent progress", () => {
  const target = "Hola. mundo";
  const exactStats = calculatePlayerStats("Hola. mundo", target, 0, 10_000, null);
  const missingDotStats = calculatePlayerStats("Hola mundo", target, 0, 10_000, null);

  assert.equal(exactStats.progress, 100);
  assert.equal(exactStats.mistakes, 0);
  assert.ok(missingDotStats.progress < 100);
  assert.equal(missingDotStats.mistakes, 1);
});
