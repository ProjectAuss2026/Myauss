import prisma from '../src/prismaClient.js';
import bcrypt from 'bcrypt';
import { validatePasswordPolicy } from '../src/utils/passwordPolicy.js';

async function main() {
  const sponsorshipPage = await prisma.sponsorshipPage.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      pageContent:
        'AUSS is proudly supported by partners who help power our events, training, and community. From activewear and strength gear to local gyms and tech — we are grateful for each one.',
    },
  });

  // ── Real AUSS sponsors & partners ────────────────────────────────────────
  // Remove old placeholder records if they exist, then upsert real partners.
  await prisma.sponsor.deleteMany({
    where: {
      name: { in: ['IronGrip Supplements', 'LiftWear NZ', 'BarBend Athletics'] },
    },
  });

  const realSponsors = [
    {
      name: 'Auckland Powerlifting',
      logoUrl: 'https://prodcdn.sporty.co.nz/cms/6177/37265/menulogo_wo.png?v=639049691564800000',
      heroImageUrl: '/sponsors/auckland-powerlifting.png',
      websiteUrl: 'https://www.sporty.co.nz/aucklandpowerlifting/home-1',
      displayOrder: 1,
    },
    {
      name: 'Sisyphus Strength',
      logoUrl: 'https://images.squarespace-cdn.com/content/v1/59a63160e6f2e1da6add5306/1504476925944-4S0S7XOHFXBNOFOKSRSO/Logo.png?format=1500w',
      heroImageUrl: '/sponsors/sisyphus-strength.png',
      websiteUrl: 'https://sisyphusstrength.com/',
      displayOrder: 2,
    },
    {
      name: 'LSKD',
      logoUrl: 'https://www.lskd.co/cdn/shop/t/683/assets/LSKD_Logo.svg?v=722165747519305061755927263',
      heroImageUrl: '/sponsors/lskd.png',
      websiteUrl: 'https://www.lskd.co/',
      displayOrder: 3,
    },
    {
      name: 'Lorna Jane',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/en/b/b2/Lorna_Jane_logo.svg',
      heroImageUrl: '/sponsors/lorna-jane.png',
      websiteUrl: 'https://www.lornajane.nz/',
      displayOrder: 4,
    },
    {
      name: 'Neva Fold Collection',
      logoUrl: 'https://nevafoldcollection.com/cdn/shop/files/Untitled-1_22d12562-5bf3-4827-9caa-51cd9a4d5fab_360x.png?v=1630413366',
      heroImageUrl: '/sponsors/neva-fold.png',
      websiteUrl: 'https://nevafoldcollection.com/',
      displayOrder: 5,
    },
    {
      name: 'Avancus',
      logoUrl: 'https://avancus.com/cdn/shop/files/avancus-logo_6af6eab7-70ac-48c3-a614-6e88e79639fd.svg?v=1686243626',
      heroImageUrl: '/sponsors/avancus.png',
      websiteUrl: 'https://avancus.com/en-nz',
      displayOrder: 6,
    },
    {
      name: 'Shipcode',
      logoUrl: 'https://assets.shipcode.com/c38e09d0-5746-4a8a-a450-a86c9aaed9c0.svg',
      heroImageUrl: 'https://assets.shipcode.com/795342d1-c7f4-4ea3-809e-42bd7ee06db0.jpg',
      websiteUrl: 'https://shipcode.com/',
      displayOrder: 7,
    },
  ];

  for (const s of realSponsors) {
    const existing = await prisma.sponsor.findFirst({
      where: { name: s.name, sponsorshipPageId: sponsorshipPage.id },
    });
    if (existing) {
      await prisma.sponsor.update({
        where: { id: existing.id },
        data: { logoUrl: s.logoUrl, heroImageUrl: s.heroImageUrl, websiteUrl: s.websiteUrl, displayOrder: s.displayOrder },
      });
    } else {
      await prisma.sponsor.create({
        data: { ...s, sponsorshipPageId: sponsorshipPage.id },
      });
    }
  }

  const mediaEntryCount = await prisma.mediaEntry.count();
  if (mediaEntryCount === 0) {
    const latestActivity = await prisma.activity.findFirst({
      orderBy: { startTime: 'desc' },
    });

    if (latestActivity) {
      await prisma.mediaEntry.create({
        data: {
          activityId: latestActivity.id,
          mediaDriveUrl: 'https://drive.google.com',
        },
      });
    }
  }

  // ── Gallery Activities & Media Entries ────────────────────────────────────
  // Cover images sourced from individual photo pages on danbainvisuals.pixieset.com
  const galleryActivitiesData = [
    {
      title: 'Amrapathon',
      description:
        'Our signature endurance challenge where members test their limits with as many rounds as possible. An incredible display of strength and community spirit.',
      startTime: new Date('2025-04-10T00:00:00.000Z'),
      endTime: new Date('2025-04-10T23:00:00.000Z'),
      imageUrl: 'https://images.pixieset.com/343267011/aadc4921d7d811cb3e0bfa720422d7d0-large.jpg',
      pixiesetUrl: 'https://danbainvisuals.pixieset.com/auss/amrapathon/',
    },
    {
      title: 'Bench Night',
      description:
        'A dedicated bench press session where members push their limits, compete for top lifts, and celebrate the grind with great energy.',
      startTime: new Date('2025-03-25T00:00:00.000Z'),
      endTime: new Date('2025-03-25T22:00:00.000Z'),
      imageUrl: 'https://images.pixieset.com/343267011/7ee3098a16774595483f589ab674bcba-large.jpg',
      pixiesetUrl: 'https://danbainvisuals.pixieset.com/auss/benchnight/',
    },
    {
      title: 'Interactive Seminar',
      description:
        'An educational session led by experienced lifters covering technique, programming, and competition prep for aspiring powerlifters.',
      startTime: new Date('2025-03-08T00:00:00.000Z'),
      endTime: new Date('2025-03-08T22:00:00.000Z'),
      imageUrl: 'https://images.pixieset.com/343267011/8ef4c7d2d68db4be0c23b45a9269e0bc-large.jpg',
      pixiesetUrl: 'https://danbainvisuals.pixieset.com/auss/interactiveseminar/',
    },
    {
      title: "Beginner's Night",
      description:
        "A welcoming introduction event for new members to learn the basics of powerlifting, meet the team, and get their first taste of the barbell.",
      startTime: new Date('2025-02-20T00:00:00.000Z'),
      endTime: new Date('2025-02-20T22:00:00.000Z'),
      imageUrl: 'https://images.pixieset.com/343267011/87b6237b3ac40739189aa0d40bff4672-large.jpg',
      pixiesetUrl: 'https://danbainvisuals.pixieset.com/auss/beginnersnight/',
    },
    {
      title: 'Orientation Week',
      description:
        'Three days of activities during O-Week where we welcomed new students and showcased everything our strength society has to offer.',
      startTime: new Date('2025-02-05T00:00:00.000Z'),
      endTime: new Date('2025-02-07T18:00:00.000Z'),
      imageUrl: 'https://images.pixieset.com/343267011/1edae850948b86b436d3e5804e336364-large.jpg',
      pixiesetUrl: 'https://danbainvisuals.pixieset.com/auss/orientationweek/',
    },
    {
      title: 'AUSS Gallery',
      description:
        'A curated collection of highlights from across the year, celebrating the milestones, PRs, and moments that defined our community.',
      startTime: new Date('2025-01-20T00:00:00.000Z'),
      endTime: new Date('2025-01-20T21:00:00.000Z'),
      imageUrl: 'https://images.pixieset.com/343267011/d57d0617206bce5a7e895012b9fd8818-cover.jpg',
      pixiesetUrl: 'https://danbainvisuals.pixieset.com/auss/',
    },
    {
      title: 'Landing',
      description:
        'The official AUSS season launch event, marking the start of a new training year with introductions, goals, and community bonding.',
      startTime: new Date('2025-01-10T00:00:00.000Z'),
      endTime: new Date('2025-01-10T21:00:00.000Z'),
      imageUrl: 'https://images.pixieset.com/343267011/087261a05f6fbe524a12ab04cbd19e39-large.jpg',
      pixiesetUrl: 'https://danbainvisuals.pixieset.com/auss/landing/',
    },
  ];

  const existingActivities = await prisma.activity.findMany({
    select: { id: true, title: true },
  });
  const existingTitleMap = new Map(existingActivities.map((a) => [a.title, a.id]));

  for (const actData of galleryActivitiesData) {
    let activityId = existingTitleMap.get(actData.title);

    if (!activityId) {
      const created = await prisma.activity.create({
        data: {
          title: actData.title,
          description: actData.description,
          startTime: actData.startTime,
          endTime: actData.endTime,
          imageUrl: actData.imageUrl,
          isPublished: true,
        },
      });
      activityId = created.id;
    }

    const existingMedia = await prisma.mediaEntry.findFirst({
      where: { activityId },
    });
    if (!existingMedia) {
      await prisma.mediaEntry.create({
        data: {
          activityId,
          mediaDriveUrl: actData.pixiesetUrl,
          overrideCover: null,
        },
      });
    }
  }

  // ── Exec Roles ────────────────────────────────────────────────────────────
  // President (id:1) and VP (id:2) must be seeded first — they are protected from deletion.
  const execRolesData = [
    { id: 1, name: 'President' },
    { id: 2, name: 'Vice President' },
    { id: 3, name: 'Secretary' },
    { id: 4, name: 'Treasurer' },
    { id: 5, name: 'Events Director' },
    { id: 6, name: 'Marketing Director' },
    { id: 7, name: 'Welfare Officer' },
    { id: 8, name: 'General Executive' },
  ];

  for (const r of execRolesData) {
    await prisma.execRole.upsert({
      where: { id: r.id },
      update: { name: r.name },
      create: { id: r.id, name: r.name },
    });
  }

  // ── Exec Teams ────────────────────────────────────────────────────────────
  const execTeamsData = [
    { id: 1, name: 'Executive Board' },
    { id: 2, name: 'General Committee' },
  ];

  for (const t of execTeamsData) {
    await prisma.execTeam.upsert({
      where: { id: t.id },
      update: { name: t.name },
      create: { id: t.id, name: t.name },
    });
  }

  // ── Exec Members (placeholder) ────────────────────────────────────────────
  const execCount = await prisma.executive.count();
  if (execCount === 0) {
    await prisma.executive.createMany({
      data: [
        { name: 'President Placeholder', roleId: 1, teamId: 1 },
        { name: 'Vice President Placeholder', roleId: 2, teamId: 1 },
        { name: 'Secretary Placeholder', roleId: 3, teamId: 1 },
        { name: 'Treasurer Placeholder', roleId: 4, teamId: 1 },
        { name: 'Events Director Placeholder', roleId: 5, teamId: 2 },
        { name: 'Marketing Director Placeholder', roleId: 6, teamId: 2 },
        { name: 'Welfare Officer Placeholder', roleId: 7, teamId: 2 },
      ],
    });
  }

  // ── FAQ entries (mirrors current hardcoded About.tsx FAQ) ─────────────────
  const faqCount = await prisma.faq.count();
  if (faqCount === 0) {
    await prisma.faq.createMany({
      data: [
        {
          question: 'Do I need to be a student?',
          answer: 'Yes, AUSS is exclusively for current Auckland University students. Just bring your student ID when you join!',
        },
        {
          question: 'Is there a membership fee?',
          answer: 'AUSS has a small annual membership fee of $20 to cover club activities and events. This is separate from gym membership.',
        },
        {
          question: "I've never lifted before. Can I still join?",
          answer: 'Absolutely! We welcome beginners and will teach you everything you need to know. Most of our members started with zero experience.',
        },
        {
          question: 'What equipment do I need?',
          answer: "Just bring yourself, comfortable workout clothes, and athletic shoes. The Recreation Centre has all the equipment you'll need.",
        },
        {
          question: 'When and where do you train?',
          answer: 'We train at the Auckland University Recreation Centre on Symonds Street. Sessions run Mon, Wed, Fri 6-8 PM and Sat 10 AM-12 PM.',
        },
      ],
    });
  }

  // ── Member content (gated dashboard perks — KAN-167) ─────────────────────
  // These rows back the members-only sections of the dashboard. They previously
  // lived hardcoded in frontend/src/app/pages/MemberDashboard.tsx and were only
  // CSS-blurred, so anyone could read them from the JS bundle. They now live
  // here and are served only by the authenticated, VERIFIED-membership endpoint
  // GET /api/member/content.
  //
  // NOTE FOR THE COMMITTEE: the discount codes below are the sample values that
  // shipped in the old frontend. Confirm whether they are live sponsor codes or
  // placeholders and replace them here (they are no longer public either way).
  const memberContentSeed = [
    {
      id: 1,
      type: 'DISCOUNT_CODE',
      title: 'FitNutrition',
      body: '20% off supplements',
      code: 'AUSS20',
      metadata: { tier: 'Platinum' },
      displayOrder: 1,
    },
    {
      id: 2,
      type: 'DISCOUNT_CODE',
      title: 'IronWorks Gym',
      body: 'Free week pass',
      code: 'AUSSFIT',
      metadata: { tier: 'Gold' },
      displayOrder: 2,
    },
    {
      id: 3,
      type: 'DISCOUNT_CODE',
      title: 'Athletic Apparel Co',
      body: '15% off all gear',
      code: 'STRENGTH15',
      metadata: { tier: 'Silver' },
      displayOrder: 3,
    },
    {
      id: 4,
      type: 'EXCLUSIVE_CONTENT',
      title: 'Advanced Powerlifting Program',
      body: '12-week periodized strength training plan',
      metadata: { tag: 'New' },
      displayOrder: 1,
    },
    {
      id: 5,
      type: 'EXCLUSIVE_CONTENT',
      title: 'Nutrition Guide for Athletes',
      body: 'Evidence-based meal planning and macros',
      metadata: { tag: 'Popular' },
      displayOrder: 2,
    },
    {
      id: 6,
      type: 'EXCLUSIVE_CONTENT',
      title: 'Competition Prep Handbook',
      body: 'Everything you need for your first meet',
      metadata: {},
      displayOrder: 3,
    },
    {
      id: 7,
      type: 'PRIVATE_LINK',
      title: 'Members Discord Server',
      body: '',
      url: 'https://discord.gg/auss-members',
      displayOrder: 1,
    },
    {
      id: 8,
      type: 'PRIVATE_LINK',
      title: 'Training Drive (Google Drive)',
      body: '',
      url: 'https://drive.google.com/auss',
      displayOrder: 2,
    },
    {
      id: 9,
      type: 'PRIVATE_LINK',
      title: 'WhatsApp Community',
      body: '',
      url: 'https://chat.whatsapp.com/auss',
      displayOrder: 3,
    },
    {
      id: 10,
      type: 'PRIVATE_LINK',
      title: 'Member Portal (Canvas)',
      body: '',
      url: 'https://canvas.auckland.ac.nz',
      displayOrder: 4,
    },
  ];

  for (const item of memberContentSeed) {
    const { id, ...rest } = item;
    await prisma.memberContent.upsert({
      where: { id },
      update: { ...rest, visibility: 'MEMBERS', isActive: true },
      create: { id, ...rest, visibility: 'MEMBERS', isActive: true },
    });
  }

  // ── Optional secure owner bootstrap ──────────────────────────────────────
  const bootstrapEmail = String(process.env.OWNER_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
  const bootstrapPassword = process.env.OWNER_BOOTSTRAP_PASSWORD;

  if (bootstrapEmail && bootstrapPassword) {
    const passwordPolicy = validatePasswordPolicy(bootstrapPassword, [bootstrapEmail, 'owner', 'admin']);
    if (!passwordPolicy.ok) {
      // SECURITY (CodeQL #6): the policy detail is derived from the password and
      // must not reach the generic error log below. Fail with static, actionable
      // guidance instead of interpolating `passwordPolicy.error`.
      console.error(
        '[seed] OWNER_BOOTSTRAP_PASSWORD does not meet the password policy. Update it and re-run.',
      );
      throw new Error('OWNER_BOOTSTRAP_PASSWORD is invalid');
    }

    const passwordHash = await bcrypt.hash(passwordPolicy.normalizedPassword, 10);
    const existingOwner = await prisma.user.findUnique({ where: { email: bootstrapEmail } });

    if (existingOwner) {
      await prisma.user.update({
        where: { email: bootstrapEmail },
        data: {
          passwordHash,
          role: 'OWNER',
          isVerified: true,
          verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email: bootstrapEmail,
          passwordHash,
          role: 'OWNER',
          isVerified: true,
          lastCodeSentAt: new Date(),
          verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    console.log(`[seed] Bootstrapped OWNER account for ${bootstrapEmail}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('[seed] Failed to seed database:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
