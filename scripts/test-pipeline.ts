import { runLeadPipelineTests } from '../src/lib/__tests__/leadPipeline.test';

console.log('================================================================');
console.log('FIGUREDIT: RUNNING LEAD INGESTION PIPELINE TEST SUITE');
console.log('================================================================');

const results = runLeadPipelineTests();
let allPassed = true;

results.forEach((res, idx) => {
  if (res.passed) {
    console.log(`[PASS] #${idx + 1}: ${res.test}`);
  } else {
    allPassed = false;
    console.error(`[FAIL] #${idx + 1}: ${res.test} - ${res.message}`);
  }
});

console.log('================================================================');
console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
console.log('================================================================');

if (!allPassed) {
  process.exit(1);
} else {
  console.log('ALL PIPELINE TEST FIXTURES PASSED SUCCESSFULLY!');
}
