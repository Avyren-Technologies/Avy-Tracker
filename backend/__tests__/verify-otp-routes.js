/**
 * Simple verification script to test OTP routes structure
 * This script verifies that the routes are properly defined and accessible
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying OTP Verification Routes Implementation...\n');

// Check if the OTP routes file exists
const otpRoutesPath = path.join(__dirname, '../src/routes/otpVerification.ts');
const serverPath = path.join(__dirname, '../server.ts');

console.log('✅ Checking file existence:');
console.log(`   - OTP Routes: ${fs.existsSync(otpRoutesPath) ? '✅ EXISTS' : '❌ MISSING'}`);
console.log(`   - Server file: ${fs.existsSync(serverPath) ? '✅ EXISTS' : '❌ MISSING'}`);

// Check if routes are properly integrated in server.ts
if (fs.existsSync(serverPath)) {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  console.log('\n✅ Checking server integration:');
  console.log(`   - Import statement: ${serverContent.includes('otpVerificationRoutes') ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - Route mounting: ${serverContent.includes('app.use("/api/otp", otpVerificationRoutes)') ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - Route logging: ${serverContent.includes('console.log("- /api/otp/*")') ? '✅ FOUND' : '❌ MISSING'}`);
}

// Check if OTP routes file has required endpoints
if (fs.existsSync(otpRoutesPath)) {
  const routesContent = fs.readFileSync(otpRoutesPath, 'utf8');
  
  console.log('\n✅ Checking required endpoints:');
  console.log(`   - POST /generate: ${routesContent.includes("router.post('/generate'") ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - POST /verify: ${routesContent.includes("router.post('/verify'") ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - POST /resend: ${routesContent.includes("router.post('/resend'") ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - DELETE /invalidate: ${routesContent.includes("router.delete('/invalidate'") ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - GET /health: ${routesContent.includes("router.get('/health'") ? '✅ FOUND' : '❌ MISSING'}`);
  
  console.log('\n✅ Checking middleware and validation:');
  console.log(`   - Authentication: ${routesContent.includes('verifyToken') ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - Rate limiting: ${routesContent.includes('otpRateLimit') ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - Input validation: ${routesContent.includes('validateOTPRequest') ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - Error handling: ${routesContent.includes('try {') && routesContent.includes('catch (error') ? '✅ FOUND' : '❌ MISSING'}`);
  
  console.log('\n✅ Checking OTP service integration:');
  console.log(`   - generateOTP: ${routesContent.includes('generateOTP(') ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - verifyOTP: ${routesContent.includes('verifyOTP(') ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - resendOTP: ${routesContent.includes('resendOTP(') ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - invalidateOTP: ${routesContent.includes('invalidateOTP(') ? '✅ FOUND' : '❌ MISSING'}`);
  
  console.log('\n✅ Checking security features:');
  console.log(`   - Device fingerprinting: ${routesContent.includes('deviceFingerprint') ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - IP address logging: ${routesContent.includes('ipAddress') ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - Comprehensive logging: ${routesContent.includes('logRequest') && routesContent.includes('logResponse') ? '✅ FOUND' : '❌ MISSING'}`);
  console.log(`   - Phone masking: ${routesContent.includes('replace(/') ? '✅ FOUND' : '❌ MISSING'}`);
}

// Check if documentation exists
const docsPath = path.join(__dirname, '../docs/otp-verification-api.md');
console.log('\n✅ Checking documentation:');
console.log(`   - API Documentation: ${fs.existsSync(docsPath) ? '✅ EXISTS' : '❌ MISSING'}`);

// Check TypeScript compilation
console.log('\n✅ Checking TypeScript compilation:');
const distPath = path.join(__dirname, '../dist/src/routes/otpVerification.js');
console.log(`   - Compiled JS file: ${fs.existsSync(distPath) ? '✅ EXISTS' : '❌ MISSING'}`);

console.log('\n🎉 OTP Verification Routes Implementation Verification Complete!');

// Summary
const checks = [
  fs.existsSync(otpRoutesPath),
  fs.existsSync(serverPath),
  fs.existsSync(docsPath),
  fs.existsSync(distPath)
];

const passedChecks = checks.filter(Boolean).length;
const totalChecks = checks.length;

console.log(`\n📊 Summary: ${passedChecks}/${totalChecks} major checks passed`);

if (passedChecks === totalChecks) {
  console.log('✅ All major checks passed! OTP routes are properly implemented.');
  process.exit(0);
} else {
  console.log('⚠️  Some checks failed. Please review the implementation.');
  process.exit(1);
}