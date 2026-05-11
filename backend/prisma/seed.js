import prisma from '../src/prismaClient.js';

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
