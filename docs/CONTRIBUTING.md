# Pull Request (PR) Expectations & Guidelines

To ensure stability and team velocity, we strictly adhere to the following guidelines for all Pull Requests. These are largely taken from or inspired by [Google Engineering Practices](https://google.github.io/eng-practices/)

## 1. Submission Requirements
Do not request a review until **all** of the following are true. Incomplete PRs may be closed without review.

* **Green Build:** All existing tests and lint checks must pass.
* **New Test Coverage:**
    * **Unit Tests:** Minimum of **3** new or significantly altered unit tests.
    * **E2E Tests:** Minimum of **1** new End-to-End test covering the user flow.
* **Description:** Include a succinct description explaining *what* changed and *why*.

## 2. Review Workflow & SLAs
Code review is a high priority to prevent work from stagnating.

* **Response Time:** Reviewers must provide feedback or approval within **24 hours**.
* **The "2-Day" Rule:** Limit back-and-forth debates to **2 days**. If unresolved, a "Decider" must cast a tie-breaking vote to keep the team moving.

## 3. Best Practices (Google Engineering Style)
We adopt these industry standards to maintain high code quality.

### Keep It Small
Google emphasizes **small, atomic CLs (Change Lists)**.
* Avoid massive PRs; split distinct features into separate submissions.
* *Benefit:* Small PRs are reviewed faster, contain fewer bugs, and are easier to roll back.

### The "Boy Scout" Rule
* *Leave the code better than you found it.*
* If you spot a minor issue (e.g., messy naming or typos) while editing a file, fix it alongside your feature to improve overall project health.

### Professionalism
* **Critique the code, not the person.** (e.g., "This loop implies O(n^2) complexity" vs "You wrote a slow loop").
* **Treat comments as discussions.** Explain the *why* behind your suggestions.

### Value Velocity
* **Block only for critical issues.** Reviewers should only hold up a PR for bugs, logic errors, or architectural flaws.
* **Don't block on "Nits".** Minor stylistic preferences or non-critical suggestions should be noted but **should not prevent approval** (create an issue item for them if needed and address in a separate PR). If the code is correct and passes the linter, approve it to keep the team moving.