async function main() {
  const mod = await import("./app/api/studio/import-github/route");
  console.log("route ok", Object.keys(mod));
}

main().catch((error) => {
  console.error("FAILED", String(error));
  process.exit(1);
});
