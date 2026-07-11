import assert from "node:assert/strict";
import test from "node:test";
import {
  DEGEN_PERSONA_QUESTIONS,
  computeDegenPersonaResultFromAnswers
} from "../src/degen-persona-engine.js";

const profile = {
  social: 1.2,
  signal: 1.2,
  execution: 2,
  risk: 1.2,
  horizon: 1.2,
  validation: 2
};

function balancedAnswers(perDimension, values = profile) {
  const used = {};
  const answers = {};

  DEGEN_PERSONA_QUESTIONS.forEach((question, index) => {
    used[question.dim] ||= 0;
    if (used[question.dim] >= perDimension) return;
    answers[`degenPersona:${index}`] = values[question.dim];
    used[question.dim] += 1;
  });

  return answers;
}

test("normalization is stable across multiple archetype directions", () => {
  const archetypes = [
    profile,
    { social: -1.2, signal: -1.2, execution: -1.2, risk: -1.2, horizon: -1.2, validation: -1.2 },
    { social: 0.35, signal: 0.35, execution: 0.35, risk: 0.35, horizon: 1.2, validation: 2 },
    { social: -1.2, signal: -1.2, execution: -1.2, risk: -0.35, horizon: -0.35, validation: -0.35 }
  ];

  for (const archetype of archetypes) {
    const results = [2, 4, 12].map((count) => (
      computeDegenPersonaResultFromAnswers(balancedAnswers(count, archetype))
    ));
    const [baseline] = results;

    for (const result of results.slice(1)) {
      assert.equal(result.type.abbr, baseline.type.abbr);
      assert.equal(result.axisCode, baseline.axisCode);
      assert.equal(result.subtype.code, baseline.subtype.code);
      assert.equal(result.intensity.tier, baseline.intensity.tier);
      assert.deepEqual(result.scores, baseline.scores);
    }
  }
});

test("balanced 12, 24, and 72 question samples keep the same classification", () => {
  const quick = computeDegenPersonaResultFromAnswers(balancedAnswers(2));
  const standard = computeDegenPersonaResultFromAnswers(balancedAnswers(4));
  const full = computeDegenPersonaResultFromAnswers(balancedAnswers(12));

  for (const result of [standard, full]) {
    assert.equal(result.type.abbr, quick.type.abbr);
    assert.equal(result.axisCode, quick.axisCode);
    assert.equal(result.subtype.code, quick.subtype.code);
    assert.equal(result.intensity.tier, quick.intensity.tier);
    assert.deepEqual(result.scores, quick.scores);
    assert.deepEqual(
      result.dimensions.map(({ key, strength }) => ({ key, strength })),
      quick.dimensions.map(({ key, strength }) => ({ key, strength }))
    );
  }

  assert.equal(quick.confidence.label, "初步倾向");
  assert.equal(standard.confidence.label, "中等置信");
  assert.equal(full.confidence.label, "高置信");
  assert.ok(quick.confidence.score < standard.confidence.score);
  assert.ok(standard.confidence.score < full.confidence.score);
});

test("dimension strength uses the full normalized range instead of capping at raw score 50", () => {
  const result = computeDegenPersonaResultFromAnswers(balancedAnswers(12));
  const strengths = Object.fromEntries(result.dimensions.map((dimension) => [dimension.key, dimension.strength]));

  assert.equal(strengths.social, 60);
  assert.equal(strengths.execution, 100);
  assert.equal(strengths.validation, 100);
});
