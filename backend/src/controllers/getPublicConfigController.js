import prisma from '../prismaClient.js';

const DEFAULTS = {
  email: 'auss@auckland.ac.nz',
  instagram_url: 'https://instagram.com/auss.uoa',
  tiktok_url: 'https://tiktok.com/@auss.uoa',
  facebook_url: 'https://facebook.com/auss.uoa',
  linkedin_url: 'https://linkedin.com/company/auss-uoa',
  discord_invite_url: 'https://discord.gg/auss',
  membership_signup_url: 'https://example.com/membership',
  media_drive_url: 'https://drive.google.com',
  sponsorship: {
    title: 'Sponsors & Partners',
    subtitle: 'Our Partners',
    body: 'AUSS is proudly supported by our partners and sponsors.',
    cta_heading: 'Become a Sponsor',
    cta_body: "Interested in supporting Auckland's strongest student community? We offer flexible sponsorship packages.",
    cta_url: 'mailto:auss@auckland.ac.nz?subject=Sponsorship%20Inquiry',
  },
};

function pickLink(links, platform, fallback) {
  const link = links.find((item) => item.platform === platform && item.isActive);
  return link?.url || fallback;
}

const getPublicConfigController = async (_req, res) => {
  try {
    const [communicationLinks, sponsorshipPage, mediaEntry] = await Promise.all([
      prisma.communicationLink.findMany({ orderBy: { platform: 'asc' } }),
      prisma.sponsorshipPage.findFirst({
        include: { sponsors: { orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] } },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.mediaEntry.findFirst({
        orderBy: [{ activity: { startTime: 'desc' } }, { id: 'desc' }],
      }),
    ]);

    return res.status(200).json({
      communications: {
        email: pickLink(communicationLinks, 'email', DEFAULTS.email),
        instagram_url: pickLink(communicationLinks, 'instagram', DEFAULTS.instagram_url),
        tiktok_url: pickLink(communicationLinks, 'tiktok', DEFAULTS.tiktok_url),
        facebook_url: pickLink(communicationLinks, 'facebook', DEFAULTS.facebook_url),
        linkedin_url: pickLink(communicationLinks, 'linkedin', DEFAULTS.linkedin_url),
        discord_invite_url: pickLink(communicationLinks, 'discord_invite', DEFAULTS.discord_invite_url),
        membership_signup_url: pickLink(communicationLinks, 'membership_signup', DEFAULTS.membership_signup_url),
        media_drive_url: mediaEntry?.mediaDriveUrl || DEFAULTS.media_drive_url,
      },
      sponsorship: {
        title: DEFAULTS.sponsorship.title,
        subtitle: DEFAULTS.sponsorship.subtitle,
        body: sponsorshipPage?.pageContent || DEFAULTS.sponsorship.body,
        cta_heading: DEFAULTS.sponsorship.cta_heading,
        cta_body: DEFAULTS.sponsorship.cta_body,
        cta_url: DEFAULTS.sponsorship.cta_url,
        sponsors: (sponsorshipPage?.sponsors || []).map((sponsor) => ({
          name: sponsor.name,
          tier: 'Partner',
          description: '',
          website: sponsor.websiteUrl || '',
        })),
      },
    });
  } catch (error) {
    console.error('[getPublicConfigController] Error fetching public config:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch public config.',
    });
  }
};

export default getPublicConfigController;
