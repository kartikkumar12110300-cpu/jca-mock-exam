import { describe, expect, it } from "vitest";
import {
  EXAM_PATTERN,
  TOTAL_QUESTIONS,
  scaledTargets,
  verdictFor,
  verdictLabel,
} from "@/lib/exam/pattern";

describe("scaled targets", () => {
  it("uses the published marks for a full paper", () => {
    expect(scaledTargets(TOTAL_QUESTIONS)).toEqual({
      pass: EXAM_PATTERN.passMark,
      target: EXAM_PATTERN.targetMark,
    });
  });

  it("scales pass and target in proportion for short papers", () => {
    expect(scaledTargets(10)).toEqual({ pass: 5, target: 8 });
    expect(scaledTargets(20)).toEqual({ pass: 10, target: 16 });
    expect(scaledTargets(50)).toEqual({ pass: 25, target: 39 });
  });

  it("never returns thresholds above the paper size", () => {
    for (const size of [1, 5, 15, 30, 99]) {
      const { pass, target } = scaledTargets(size);
      expect(pass).toBeLessThanOrEqual(size);
      expect(target).toBeLessThanOrEqual(size);
    }
  });

  it("treats an empty paper as zero marks", () => {
    expect(scaledTargets(0)).toEqual({ pass: 0, target: 0 });
  });
});

describe("verdicts", () => {
  it("classifies against the scaled thresholds", () => {
    // A 10-question drill is judged out of 5 / 8, not 50 / 78.
    expect(verdictFor(8, 10)).toBe("target");
    expect(verdictFor(5, 10)).toBe("pass");
    expect(verdictFor(4.75, 10)).toBe("below");
  });

  it("uses the raw thresholds on a full paper", () => {
    expect(verdictFor(80, TOTAL_QUESTIONS)).toBe("target");
    expect(verdictFor(50, TOTAL_QUESTIONS)).toBe("pass");
    expect(verdictFor(49.75, TOTAL_QUESTIONS)).toBe("below");
  });

  it("labels every verdict", () => {
    expect(verdictLabel("target")).toBe("At target");
    expect(verdictLabel("pass")).toBe("Above pass");
    expect(verdictLabel("below")).toBe("Below pass");
  });
});
