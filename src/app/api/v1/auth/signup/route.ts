import { syncIn, syncOut } from '@/lib/server/store';
import { jsonResponse, errorResponse } from '@/lib/server/api-helpers';
import { db } from '@/lib/server/db';
import { hashPassword, createSessionToken, sessionCookie, createChallengeToken, challengeCookie, mfaRequired } from '@/lib/server/auth';
import { Firm, User, Membership, Client, Engagement, UserRole } from '@/lib/types/models';
import { emailError, passwordError } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const fullName = String(body.fullName || '').trim();
    const workEmail = String(body.workEmail || '').trim().toLowerCase();
    const firmName = String(body.firmName || '').trim();
    const password = String(body.password || '');
    const role = String(body.role || 'manager').toLowerCase() as UserRole;

    if (!(['preparer', 'reviewer', 'manager', 'partner', 'admin'] as UserRole[]).includes(role)) {
      return jsonResponse({ error: 'Choose a valid role.' }, 400);
    }
    if (!fullName) {
      return jsonResponse({ error: 'Please enter your full name.' }, 400);
    }
    const badEmail = emailError(workEmail);
    if (badEmail) {
      return jsonResponse({ error: badEmail }, 400);
    }
    if (!firmName) {
      return jsonResponse({ error: 'Please enter your accounting firm or practice name.' }, 400);
    }
    const badPassword = passwordError(password, { email: workEmail, name: fullName });
    if (badPassword) {
      return jsonResponse({ error: badPassword }, 400);
    }

    await syncIn();

    // Check if email already registered
    const existingUser = db.users.find((u) => u.email.toLowerCase() === workEmail);
    if (existingUser) {
      return jsonResponse(
        { error: 'An account with this email address already exists. Please sign in instead.' },
        409
      );
    }

    // 1. Create unique Firm
    const firmId = `firm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newFirm: Firm = {
      id: firmId,
      name: firmName,
      created_at: new Date().toISOString(),
      owner_user_id: userId,
      onboarding: { step: 0, completed_at: null }, // the set-up wizard runs next
    };
    db.firms.push(newFirm);

    // 2. Create User
    const nameParts = fullName.split(' ').filter(Boolean);
    const initials = (
      (nameParts[0]?.[0] || 'A') + (nameParts[nameParts.length - 1]?.[0] || 'D')
    ).toUpperCase();

    const titleMap: Record<UserRole, string> = {
      partner: 'Engagement Partner',
      manager: 'Audit Manager',
      reviewer: 'Audit Reviewer',
      preparer: 'Senior Associate / Preparer',
      admin: 'Firm Administrator',
    };

    const newUser: User = {
      id: userId,
      email: workEmail,
      name: fullName,
      initials,
      title: titleMap[role] || 'Audit Professional',
      mfa_enabled: false,
    };
    db.users.push(newUser);

    // 3. Create Membership
    const membership: Membership = {
      user_id: userId,
      firm_id: firmId,
      role,
    };
    db.memberships.push(membership);

    // 4. Save Password Credential
    db.credentials.push({
      user_id: userId,
      password_hash: hashPassword(password),
    });

    // 5. Create a starter client & engagement for this firm so workpapers are immediately ready
    const clientId = `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const starterClient: Client = {
      id: clientId,
      firm_id: firmId,
      name: `${firmName} - Primary Client Ltd`,
      company_no: '14829104',
      company_type: 'Small company (FRS 102 1A)',
      year_end: '2026-09-30',
      data_source: 'xero',
      reconnect_needed: false,
    };
    db.clients.push(starterClient);

    const engId = `eng_${clientId.replace('cli_', '')}_fy26`;
    const starterEng: Engagement = {
      id: engId,
      client_id: clientId,
      firm_id: firmId,
      period_start: '2025-10-01',
      period_end: '2026-09-30',
      framework: 'FRS 102 1A',
      template_pack_id: 'pack_small_co',
      status: 'planning',
      locked_at: null,
      locked_by: null,
      prior_engagement_id: null,
    };
    db.engagements.push(starterEng);

    // Generate standard working papers from pack
    db.createEngagementWorkpapers(engId, starterClient.company_type);

    // 6. Audit log
    db.logAudit(
      firmId,
      { id: userId, name: newUser.name, role: membership.role },
      'SIGNUP',
      'firms',
      firmId,
      null,
      {
        email: newUser.email,
        firmName: newFirm.name,
      }
    );

    await syncOut();

    // 7. ADM-01: MFA is set up before the first session; the wizard follows
    const result = { success: true, user: newUser, firm: newFirm, role: membership.role, clientId: starterClient.id, engagementId: starterEng.id };
    if (mfaRequired()) {
      return jsonResponse({ ...result, mfa: 'setup' }, 201, { 'Set-Cookie': challengeCookie(createChallengeToken(userId)) });
    }
    return jsonResponse(result, 201, { 'Set-Cookie': sessionCookie(createSessionToken(userId)) });
  } catch (err) {
    return errorResponse(err);
  }
}
