"""The builder's preview must pick exactly what the email will.

Runs `_select_from_groups` (Python, the sender) and `selectFromGroups`
(frontend/lib/newsletter-select.ts, the live preview) over the same
randomised pools and asserts identical output.

  python3 -m unittest v3.test_newsletter_parity
"""

from __future__ import annotations

import json
import random
import shutil
import subprocess
import unittest
from pathlib import Path

from v3.flows.send_audience_newsletter import LANE_ORDER, _select_from_groups

REPO_ROOT = Path(__file__).resolve().parents[1]
TS_MODULE = REPO_ROOT / "frontend" / "lib" / "newsletter-select.ts"

NODE_RUNNER = """
import { selectFromGroups } from %s;
const cases = JSON.parse(await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => { data += chunk; });
  process.stdin.on('end', () => resolve(data));
}));
const out = cases.map((c) => selectFromGroups(c.pool, c.interests, c.count, c.bucket)
  .map(([lane, stories]) => [lane, stories.map((s) => s.topic_id)]));
process.stdout.write(JSON.stringify(out));
"""


def _pool(rng: random.Random, size: int) -> list[dict]:
    lanes = list(LANE_ORDER) + ["fintech"]
    return [
        {
            "topic_id": f"t{i}",
            "title": f"Story {i}",
            "summary": "",
            "url": f"https://e.com/{i}",
            "source_name": "E",
            "sources": ["e.com"],
            "interest_id": rng.choice(lanes),
            "send_worthy": rng.choice([None, 1, 2]),
            "source_count": rng.randint(1, 5),
            "coverage": rng.randint(1, 3),
            "macro": rng.random() < 0.2,
            "model_release": rng.random() < 0.1,
        }
        for i in range(size)
    ]


@unittest.skipUnless(shutil.which("node"), "node is not installed")
class ParityTests(unittest.TestCase):
    def test_preview_matches_sender(self):
        rng = random.Random(7)
        cases = []
        for _ in range(250):
            cases.append({
                "pool": _pool(rng, rng.randint(0, 40)),
                "interests": rng.sample(list(LANE_ORDER), rng.randint(0, 4)),
                "count": rng.choice([5, 10, 15]),
                "bucket": rng.choice(["member", "winback", "landing"]),
            })
        expected = [
            [[lane, [s["topic_id"] for s in stories]]
             for lane, stories in _select_from_groups(
                 c["pool"], c["interests"], c["count"], c["bucket"])]
            for c in cases
        ]
        result = subprocess.run(
            ["node", "--input-type=module", "-e", NODE_RUNNER % json.dumps(TS_MODULE.as_uri())],
            input=json.dumps(cases), capture_output=True, text=True, check=True,
        )
        actual = json.loads(result.stdout)
        for index, (want, got) in enumerate(zip(expected, actual)):
            self.assertEqual(got, want, f"case {index}: {cases[index]['interests']} "
                                        f"{cases[index]['count']} {cases[index]['bucket']}")
        self.assertEqual(len(actual), len(expected))


if __name__ == "__main__":
    unittest.main()
