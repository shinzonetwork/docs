const SIZE_MAP = { XS: 1, S: 2, M: 3, L: 5, XL: 8 };
const ENDPOINT = "https://api.zenhub.com/public/graphql";

async function main() {
  const label = (process.env.LABEL_NAME || "").trim();
  const value = SIZE_MAP[label.toUpperCase()];

  if (value === undefined) {
    console.log(`Label "${label}" is not a sizing label (XS/S/M/L/XL) - skipping.`);
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
    process.exit(1);
  }

  const issueId = issueJson.data?.issueByInfo?.id;
  if (!issueId) {
    console.error(`Could not find a Zenhub issue for repo ${repositoryGhId} #${issueNumber}.`);
    process.exit(1);
  }

  const setEstimateMutation = `
    mutation setEstimate($value: Float!, $issueId: ID!) {
      setEstimate(input: { value: $value, issueId: $issueId }) {
        clientMutationId
      }
    }
  `;

  const setRes = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: setEstimateMutation,
      variables: { value, issueId },
    }),
  });

  const setJson = await setRes.json();
  if (setJson.errors) {
    console.error("Error setting estimate:", JSON.stringify(setJson.errors));
    process.exit(1);
  }

  console.log(`Set estimate to ${value} for issue #${issueNumber} (label: ${label})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
