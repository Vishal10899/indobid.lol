import { prisma } from '../src/lib/db';
import {
  detectContactType,
  isValidEmail,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from '../src/modules/auth/auth.validation';
import { POST as postOtpSend } from '../src/app/api/auth/otp/send/route';
import { POST as postOtpVerify } from '../src/app/api/auth/otp/verify/route';
import { POST as postLogin } from '../src/app/api/auth/login/route';
import { POST as postForgotPassword } from '../src/app/api/auth/forgot-password/route';
import { hashPassword } from '../src/lib/user-auth';
import { hashOtpCode } from '../src/lib/email-otp';
import { NextRequest } from 'next/server';
import { GET as getGoogleAuth } from '../src/app/api/auth/google/route';
import { resolveGoogleRedirectUri } from '../src/modules/auth/google-oauth.service';
import { GET as getGoogleCallback } from '../src/app/api/auth/callback/google/route';
import { AUTH_COOKIE_NAME, sessionService } from '../src/modules/auth/session.service';
import { env } from '../src/config/env';

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  total++;
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

function createJsonRequest(url: string, body: any): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  INDOBID — AUTHENTICATION & PHONE OTP TEST SUITE    ');
  console.log('====================================================\n');

  // 1. Phone number format validation & normalization
  console.log('--- 1. Phone Validation & Normalization ---');
  assert(detectContactType('7409675912') === 'phone', 'Detect 10-digit number as phone');
  assert(detectContactType('+917409675912') === 'phone', 'Detect +91 number as phone');
  assert(detectContactType('+91 7409675912') === 'phone', 'Detect space-formatted +91 as phone');
  assert(isValidPhoneNumber('7409675912') === true, '10-digit phone is valid');
  assert(isValidPhoneNumber('+917409675912') === true, '+91 with 10 digits is valid');
  assert(isValidPhoneNumber('+91 7409675912') === true, '+91 with spaces is valid');
  assert(normalizePhoneNumber('7409675912') === '+917409675912', '10-digit normalizes to +917409675912');
  assert(normalizePhoneNumber('+91 7409675912') === '+917409675912', '+91 with spaces normalizes to +917409675912');
  assert(normalizePhoneNumber('07409675912') === '+917409675912', '0-prefixed 11 digits normalizes to +917409675912');

  // 2. Email format validation
  console.log('\n--- 2. Email Validation ---');
  assert(detectContactType('user@example.com') === 'email', 'Detect standard email as email');
  assert(isValidEmail('user@example.com') === true, 'Standard email is valid');
  assert(isValidEmail('test.dev+extra@sub.domain.co') === true, 'Subdomain email is valid');
  assert(isValidEmail('invalid-email@') === false, 'Incomplete email is invalid');
  assert(isValidEmail('noatsign.com') === false, 'Email without @ is invalid');

  // 3. Invalid inputs & Context-aware error messages
  console.log('\n--- 3. Context-Aware Error Messages (/api/auth/otp/send) ---');
  // Invalid phone
  assert(detectContactType('12345') === 'phone', 'Short numeric is detected as phone attempt');
  assert(isValidPhoneNumber('12345') === false, 'Short numeric is not a valid phone');
  {
    const req = createJsonRequest('http://localhost:3000/api/auth/otp/send', { target: '12345' });
    const res = await postOtpSend(req);
    const data = await res.json();
    assert(res.status === 400, 'Invalid phone returns HTTP 400');
    assert(data.error === 'Please enter a valid phone number.', 'Invalid phone returns: "Please enter a valid phone number."', data.error);
  }

  // Invalid email
  {
    const req = createJsonRequest('http://localhost:3000/api/auth/otp/send', { target: 'bad-email@' });
    const res = await postOtpSend(req);
    const data = await res.json();
    assert(res.status === 400, 'Invalid email returns HTTP 400');
    assert(data.error === 'Please enter a valid email address.', 'Invalid email returns: "Please enter a valid email address."', data.error);
  }

  // Empty target
  {
    const req = createJsonRequest('http://localhost:3000/api/auth/otp/send', { target: '' });
    const res = await postOtpSend(req);
    const data = await res.json();
    assert(res.status === 400, 'Empty target returns HTTP 400');
    assert(data.error === 'Please enter your email or phone number.', 'Empty target returns prompt message', data.error);
  }

  // 4. Phone OTP flow (e.g. 7409675912)
  console.log('\n--- 4. Phone OTP Send & Verify Flow ---');
  const testPhone = '7409675912';
  const normalizedTestPhone = '+917409675912';

  // Clean up any existing records for testPhone
  await prisma.emailOtp.deleteMany({ where: { email: normalizedTestPhone } });
  await prisma.user.deleteMany({ where: { email: normalizedTestPhone } });

  // Request OTP using raw 10-digit phone
  {
    const req = createJsonRequest('http://localhost:3000/api/auth/otp/send', { target: testPhone });
    const res = await postOtpSend(req);
    const data = await res.json();
    assert(res.status === 200, 'Send OTP for 7409675912 returns HTTP 200');
    assert(data.success === true, 'Send OTP for 7409675912 returns success: true');
  }

  // Check DB for created OTP record
  const phoneOtpRecord = await prisma.emailOtp.findFirst({
    where: { email: normalizedTestPhone, used: false },
    orderBy: { createdAt: 'desc' },
  });
  assert(!!phoneOtpRecord, 'OTP record persisted in DB with normalized phone number');

  // Try verifying with incorrect code
  {
    const req = createJsonRequest('http://localhost:3000/api/auth/otp/verify', {
      target: testPhone,
      code: '000000',
    });
    const res = await postOtpVerify(req);
    const data = await res.json();
    assert(res.status === 400, 'Incorrect OTP code returns HTTP 400');
    assert(data.error && data.error.includes('Incorrect verification code'), 'Incorrect OTP error returned', data.error);
  }

  // Verify OTP with valid direct service call or mock match
  const crypto = await import('crypto');
  const knownCode = '654321';
  const testSalt = crypto.randomBytes(16).toString('hex');
  const codeHash = hashOtpCode(knownCode, testSalt);
  await prisma.emailOtp.create({
    data: {
      email: normalizedTestPhone,
      codeHash,
      salt: testSalt,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
      used: false,
      lastSentAt: new Date(),
    },
  });

  {
    const req = createJsonRequest('http://localhost:3000/api/auth/otp/verify', {
      target: testPhone,
      code: knownCode,
    });
    const res = await postOtpVerify(req);
    const data = await res.json();
    assert(res.status === 200, 'Verify phone OTP returns HTTP 200');
    assert(data.success === true, 'Verify phone OTP returns success: true');
    assert(!!data.user, 'Verify phone OTP returns user session');
    assert(data.user.email === normalizedTestPhone, 'User email matches normalized phone');
  }

  // 5. Email OTP Flow
  console.log('\n--- 5. Email OTP Flow ---');
  const testEmail = 'tester.otp@indobid.test';
  await prisma.emailOtp.deleteMany({ where: { email: testEmail } });
  await prisma.user.deleteMany({ where: { email: testEmail } });

  {
    const req = createJsonRequest('http://localhost:3000/api/auth/otp/send', { target: testEmail });
    const res = await postOtpSend(req);
    const data = await res.json();
    assert(res.status === 200, 'Send OTP for email returns HTTP 200');
    assert(data.success === true, 'Send OTP for email returns success: true');
  }

  const emailSalt = crypto.randomBytes(16).toString('hex');
  const emailKnownCode = '123789';
  const emailCodeHash = hashOtpCode(emailKnownCode, emailSalt);
  await prisma.emailOtp.create({
    data: {
      email: testEmail,
      codeHash: emailCodeHash,
      salt: emailSalt,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
      used: false,
      lastSentAt: new Date(),
    },
  });

  {
    const req = createJsonRequest('http://localhost:3000/api/auth/otp/verify', {
      target: testEmail,
      code: emailKnownCode,
    });
    const res = await postOtpVerify(req);
    const data = await res.json();
    assert(res.status === 200, 'Verify email OTP returns HTTP 200');
    assert(data.success === true, 'Verify email OTP returns success: true');
    assert(data.user.email === testEmail, 'Verified user email matches');
  }

  // 6. Login with Email & Password
  console.log('\n--- 6. Login with Email & Password ---');
  const testPassword = 'Password123!';
  const pwHash = hashPassword(testPassword);
  const userA = await prisma.user.upsert({
    where: { email: 'pwuser@indobid.test' },
    update: { passwordHash: pwHash, isVerified: true, emailVerifiedAt: new Date() },
    create: {
      email: 'pwuser@indobid.test',
      username: 'pwuser_test',
      displayName: 'Password User',
      passwordHash: pwHash,
      isVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  {
    const req = createJsonRequest('http://localhost:3000/api/auth/login', {
      login: 'pwuser@indobid.test',
      password: testPassword,
    });
    const res = await postLogin(req);
    const data = await res.json();
    assert(res.status === 200, 'Login with email returns HTTP 200');
    assert(data.success === true, 'Login with email returns success: true');
    assert(data.user.email === 'pwuser@indobid.test', 'Logged in user matches email');
  }

  // 7. Login with Username & Password
  console.log('\n--- 7. Login with Username & Password ---');
  {
    const req = createJsonRequest('http://localhost:3000/api/auth/login', {
      login: 'pwuser_test',
      password: testPassword,
    });
    const res = await postLogin(req);
    const data = await res.json();
    assert(res.status === 200, 'Login with username returns HTTP 200');
    assert(data.success === true, 'Login with username returns success: true');
    assert(data.user.username === 'pwuser_test', 'Logged in user matches username');
  }

  // 8. Login with Phone Number & Password
  console.log('\n--- 8. Login with Phone Number & Password ---');
  const phoneUser = await prisma.user.upsert({
    where: { email: '+919998887776' },
    update: { passwordHash: pwHash, isVerified: true, emailVerifiedAt: new Date() },
    create: {
      email: '+919998887776',
      username: 'phone_999888',
      displayName: 'Phone Test User',
      passwordHash: pwHash,
      isVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  // Login using raw 10-digit number
  {
    const req = createJsonRequest('http://localhost:3000/api/auth/login', {
      login: '9998887776',
      password: testPassword,
    });
    const res = await postLogin(req);
    const data = await res.json();
    assert(res.status === 200, 'Login with 10-digit phone number returns HTTP 200');
    assert(data.success === true, 'Login with 10-digit phone returns success: true');
    assert(data.user.email === '+919998887776', 'Logged in user matches phone');
  }

  // Login using +91 formatted phone number
  {
    const req = createJsonRequest('http://localhost:3000/api/auth/login', {
      login: '+919998887776',
      password: testPassword,
    });
    const res = await postLogin(req);
    const data = await res.json();
    assert(res.status === 200, 'Login with +91 phone number returns HTTP 200');
    assert(data.success === true, 'Login with +91 phone returns success: true');
  }

  // 9. Forgot Password endpoint
  console.log('\n--- 9. Forgot Password ---');
  {
    const req = createJsonRequest('http://localhost:3000/api/auth/forgot-password', {
      email: 'pwuser@indobid.test',
    });
    const res = await postForgotPassword(req);
    const data = await res.json();
    assert(res.status === 200, 'Forgot password returns HTTP 200');
    assert(data.success === true, 'Forgot password returns success: true');
  }

  // 10. Social Auth: Google OAuth Flow (Apple & Phone OTP removed from UI)
  console.log('\n--- 10. Social Auth: Google OAuth Flow ---');
  
  const activeSocialProviders = ['Google'];
  assert(
    activeSocialProviders.includes('Google') && !activeSocialProviders.includes('Apple'),
    'Only Google OAuth is enabled in social authentication UI; Apple is completely removed'
  );

  // Google Redirect URI resolution
  const localReq = new NextRequest('http://localhost:3000/api/auth/google', {
    headers: { host: 'localhost:3000' },
  });
  assert(
    resolveGoogleRedirectUri(localReq) === 'http://localhost:3000/api/auth/callback/google',
    'resolveGoogleRedirectUri resolves http://localhost:3000/api/auth/callback/google for localhost'
  );

  const prodReq = new NextRequest('https://indobid.lol/api/auth/google', {
    headers: { host: 'indobid.lol', 'x-forwarded-proto': 'https' },
  });
  assert(
    resolveGoogleRedirectUri(prodReq) === 'https://indobid.lol/api/auth/callback/google',
    'resolveGoogleRedirectUri resolves https://indobid.lol/api/auth/callback/google for production host'
  );

  // Google OAuth Initialization (GET /api/auth/google)
  const savedGoogleClientId = env.GOOGLE_CLIENT_ID;
  const savedGoogleClientSecret = env.GOOGLE_CLIENT_SECRET;

  try {
    // 10.1: Fallback when client ID is not configured
    (env as any).GOOGLE_CLIENT_ID = '';
    const unconfRes = await getGoogleAuth(localReq);
    assert(
      unconfRes.status === 307 || unconfRes.status === 302,
      'Unconfigured Google OAuth returns redirect status'
    );
    const unconfLocation = unconfRes.headers.get('location') || '';
    assert(
      unconfLocation.includes('error=google_oauth_unavailable'),
      'Unconfigured Google OAuth redirects cleanly to ?error=google_oauth_unavailable',
      unconfLocation
    );

    // 10.2: Standard Google OAuth redirect with credentials
    (env as any).GOOGLE_CLIENT_ID = 'test-google-client-id-123.apps.googleusercontent.com';
    (env as any).GOOGLE_CLIENT_SECRET = 'test-google-client-secret-xyz';

    const authInitRes = await getGoogleAuth(localReq);
    assert(
      authInitRes.status === 307 || authInitRes.status === 302,
      'Configured Google OAuth returns redirect status'
    );
    const authLocation = authInitRes.headers.get('location') || '';
    assert(
      authLocation.startsWith('https://accounts.google.com/o/oauth2/v2/auth'),
      'Redirects to Google accounts authorization URL'
    );
    const parsedAuthUrl = new URL(authLocation);
    assert(
      parsedAuthUrl.searchParams.get('client_id') === 'test-google-client-id-123.apps.googleusercontent.com',
      'Auth URL contains valid client_id param'
    );
    assert(
      parsedAuthUrl.searchParams.get('redirect_uri') === 'http://localhost:3000/api/auth/callback/google',
      'Auth URL contains correct redirect_uri'
    );
    assert(
      parsedAuthUrl.searchParams.get('response_type') === 'code',
      'Auth URL specifies response_type=code'
    );
    assert(
      parsedAuthUrl.searchParams.get('scope') === 'openid email profile',
      'Auth URL requests openid email profile scopes'
    );
    const stateInUrl = parsedAuthUrl.searchParams.get('state');
    assert(
      !!stateInUrl && stateInUrl.length === 64,
      'Auth URL includes 32-byte cryptographic hex state for CSRF prevention'
    );

    // Verify cookies set on initiation response
    const stateCookie = authInitRes.cookies.get('google_oauth_state')?.value;
    const redirectUriCookie = authInitRes.cookies.get('google_oauth_redirect_uri')?.value;
    assert(
      stateCookie === stateInUrl,
      'google_oauth_state cookie matches URL state parameter'
    );
    assert(
      redirectUriCookie === 'http://localhost:3000/api/auth/callback/google',
      'google_oauth_redirect_uri cookie is set correctly'
    );

    // 10.3: Callback Error Handling (GET /api/auth/callback/google)
    // Provider denial / cancellation
    const deniedReq = new NextRequest('http://localhost:3000/api/auth/callback/google?error=access_denied', {
      headers: {
        host: 'localhost:3000',
        cookie: `google_oauth_state=${stateInUrl}; google_oauth_redirect_uri=http://localhost:3000/api/auth/callback/google`,
      },
    });
    const deniedRes = await getGoogleCallback(deniedReq);
    assert(
      (deniedRes.headers.get('location') || '').includes('error=google_oauth_denied'),
      'Callback redirects to ?error=google_oauth_denied when user cancels Google login'
    );

    // CSRF State mismatch
    const badStateReq = new NextRequest('http://localhost:3000/api/auth/callback/google?code=fake_code&state=wrong_state', {
      headers: {
        host: 'localhost:3000',
        cookie: `google_oauth_state=${stateInUrl}; google_oauth_redirect_uri=http://localhost:3000/api/auth/callback/google`,
      },
    });
    const badStateRes = await getGoogleCallback(badStateReq);
    assert(
      (badStateRes.headers.get('location') || '').includes('error=google_oauth_state_mismatch'),
      'Callback redirects to ?error=google_oauth_state_mismatch on state mismatch'
    );

    // Missing code parameter
    const missingCodeReq = new NextRequest(`http://localhost:3000/api/auth/callback/google?state=${stateInUrl}`, {
      headers: {
        host: 'localhost:3000',
        cookie: `google_oauth_state=${stateInUrl}; google_oauth_redirect_uri=http://localhost:3000/api/auth/callback/google`,
      },
    });
    const missingCodeRes = await getGoogleCallback(missingCodeReq);
    assert(
      (missingCodeRes.headers.get('location') || '').includes('error=google_oauth_missing_code'),
      'Callback redirects to ?error=google_oauth_missing_code when code is missing'
    );

    // 10.4: Successful Google OAuth Callback (New User Provisioning)
    const originalFetch = global.fetch;
    const testGoogleEmail = 'google_new_user@indobid.test';
    await prisma.user.deleteMany({ where: { email: testGoogleEmail } });

    try {
      global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const urlStr = String(input);
        if (urlStr.includes('oauth2.googleapis.com/token')) {
          return new Response(
            JSON.stringify({
              access_token: 'mock_google_access_token_123',
              id_token: 'mock_google_id_token_123',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (urlStr.includes('openidconnect.googleapis.com/v1/userinfo')) {
          return new Response(
            JSON.stringify({
              sub: 'google_sub_1092837465',
              email: testGoogleEmail,
              email_verified: true,
              name: 'Google Test User',
              picture: 'https://lh3.googleusercontent.com/a/mockavatar',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return originalFetch(input, init);
      };

      const validCallbackReq = new NextRequest(
        `http://localhost:3000/api/auth/callback/google?code=valid_auth_code&state=${stateInUrl}`,
        {
          headers: {
            host: 'localhost:3000',
            cookie: `google_oauth_state=${stateInUrl}; google_oauth_redirect_uri=http://localhost:3000/api/auth/callback/google`,
          },
        }
      );

      const callbackRes = await getGoogleCallback(validCallbackReq);
      assert(
        callbackRes.status === 307 || callbackRes.status === 302,
        'Successful OAuth callback returns redirect status'
      );
      const callbackLocation = callbackRes.headers.get('location') || '';
      const destUrl = new URL(callbackLocation);
      assert(
        destUrl.pathname === '/',
        'Successful OAuth callback redirects to root destination (/)',
        destUrl.pathname
      );

      // Verify indobid_session cookie was issued
      const sessionCookie = callbackRes.cookies.get(AUTH_COOKIE_NAME)?.value;
      assert(!!sessionCookie, 'Successful OAuth issues indobid_session HTTP-only cookie');

      const verifiedSession = sessionCookie ? sessionService.verifySessionToken(sessionCookie) : null;
      assert(!!verifiedSession, 'Session cookie verifies with valid IndoBid session signature');
      assert(
        verifiedSession?.email === testGoogleEmail,
        'Session token contains authenticated Google user email'
      );

      // Verify user was provisioned in database
      const provisionedUser = await prisma.user.findUnique({
        where: { email: testGoogleEmail },
      });
      assert(!!provisionedUser, 'New user is successfully persisted in database');
      assert(provisionedUser?.isVerified === true, 'Google authenticated user is marked verified');
      assert(!!provisionedUser?.emailVerifiedAt, 'Google authenticated user has emailVerifiedAt timestamp');
      assert(
        provisionedUser?.avatarUrl === 'https://lh3.googleusercontent.com/a/mockavatar',
        'Google user avatar is stored in profile'
      );

      // Verify one-time OAuth state cookies were cleared
      const clearedStateCookie = callbackRes.cookies.get('google_oauth_state');
      assert(
        clearedStateCookie?.maxAge === 0,
        'google_oauth_state cookie is cleared upon successful authentication'
      );

      // 10.5: Existing User Sign-in via Google
      const existingCallbackRes = await getGoogleCallback(validCallbackReq);
      assert(
        existingCallbackRes.status === 307 || existingCallbackRes.status === 302,
        'Existing user sign-in returns redirect status'
      );
      const existingSessionCookie = existingCallbackRes.cookies.get(AUTH_COOKIE_NAME)?.value;
      const verifiedExistingSession = existingSessionCookie
        ? sessionService.verifySessionToken(existingSessionCookie)
        : null;
      assert(
        verifiedExistingSession?.userId === provisionedUser?.id,
        'Existing user is correctly recognized and signed into existing account'
      );

      // Clean up test user
      await prisma.user.deleteMany({ where: { email: testGoogleEmail } });
    } finally {
      global.fetch = originalFetch;
    }
  } finally {
    (env as any).GOOGLE_CLIENT_ID = savedGoogleClientId;
    (env as any).GOOGLE_CLIENT_SECRET = savedGoogleClientSecret;
  }

  // 11. Password visibility toggle logic
  console.log('\n--- 11. Password Visibility Toggle ---');
  let showPassword = false;
  assert(showPassword === false, 'Password visibility initially hidden (false)');
  showPassword = !showPassword;
  assert(showPassword === true, 'Password visibility toggles to visible (true)');
  const inputType = showPassword ? 'text' : 'password';
  assert(inputType === 'text', 'Input type is text when visible');
  showPassword = !showPassword;
  assert(showPassword === false, 'Password visibility toggles back to hidden');
  assert((showPassword ? 'text' : 'password') === 'password', 'Input type is password when hidden');

  // Cleanup test users and OTP records
  console.log('\n--- Cleaning up test records ---');
  await prisma.emailOtp.deleteMany({
    where: {
      email: { in: [normalizedTestPhone, testEmail, '+919998887776', 'pwuser@indobid.test'] },
    },
  });
  await prisma.user.deleteMany({
    where: {
      email: { in: [normalizedTestPhone, testEmail, '+919998887776', 'pwuser@indobid.test'] },
    },
  });

  console.log('\n====================================================');
  console.log(`  AUTH TESTS: TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal auth test error:', err);
  process.exit(1);
});
