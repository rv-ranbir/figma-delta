# Cursor dashboard benchmark

This recorded test examined whether an agent could implement and repair a complex dashboard using Figma context and objective browser verification. It is a historical result, not a reproducible performance guarantee.

## Setup

- A 1920×1732 dashboard frame with 683 descendant nodes.
- A React implementation generated using Cursor, with local source assets and mapped regions.
- A fixed reference, comparison configuration and five-capture repair budget.

## Results

| Capture | Global mismatch |
| --- | --- |
| 1 | 2.2588% |
| 2 | 2.1644% |
| 3 | 1.9488% |
| 4 | 1.8804% |
| 5 | 2.0549% |

Every capture failed regional pixel gates. The session stopped at its iteration limit. The last traffic-chart change was reverted after capture five, so the final source has no subsequent visual measurement. The best recorded global mismatch, 1.8804%, was not a passing result.

The production build and tested search/checkbox behavior passed. Local images loaded without page errors, and fixed reference/configuration/asset hashes remained unchanged. These independent checks did not establish visual correctness.

## What the test demonstrates

The tool identified useful discrepancies, including title wrapping, chart-bar differences and an image overlay mismatch. Passing mapped geometry alone did not catch all visual defects. A small global pixel score could still conceal failing regions.

The test supports using measured findings and bounded repair sessions to assist development and QA. It does not establish reliable autonomous repair, universal design coverage, accessibility or responsive correctness. Application captures and local agent-session records are not included in the distributed package.
