const SIZE_MAP = { XS: 1, S: 2, M: 3, L: 5, XL: 8 };
const ENDPOINT = "https://api.zenhub.com/public/graphql";

async function main() {
  const label = (process.env.LABEL_NAME || "").trim();
  const value = SIZE_MAP[label.toUpperCase()];

  if (value === undefined) {
    console.log(`Label "${label}" is not a sizing label (XS/S/M/L/XL) — skipping.`);
    return;
  }

  const repositoryGhId = parseInt(process.env.REPO_GH_ID, 10);
  const issueNumber = parseInt(process.env.ISSUE_NUMBER, 10);
  const apiKey = process.env.ZENHUB_API_KEY;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const issueQuery = `
    query getIssueInfo($repositoryGhId: Int!, $issueNumber: Int!) {
      issueByInfo(repositoryGhId: $repositoryGhId, issueNumber: $issueNumber) {
        id
      }
    }
  `;

  const issueRes = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: issueQuery,
      variables: { repositoryGhId, issueNumber },
    }),
  });
  const issueJson = await issueRes.json();

  if (issueJson.errors) {
    console.error("Error fetching issue:", JSON.stringify(issueJson.errors));
