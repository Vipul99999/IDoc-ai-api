const baseUrl = process.env.WEB_URL ?? "http://localhost:3000";
const token = process.env.INTELLIDOC_TOKEN;

const response = await fetch(`${baseUrl}/api/benchmarks/ocr`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify({ groundTruth: {} })
});

if (!response.ok) {
  console.error(`OCR benchmark failed: ${response.status}`);
  process.exit(1);
}

const { benchmark } = await response.json();
console.log(JSON.stringify(benchmark, null, 2));
