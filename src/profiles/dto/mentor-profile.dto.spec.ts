import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../../common/index.js';
import {
  MentorProfileDto,
  MentorProfileHighlightsDto,
  MentorSocialLinkDto,
} from './mentor-profile.dto.js';

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: MentorProfileDto,
};

const highlights = {
  workplaces: ['Senior backend engineer at Nordwave Software'],
  achievements: ['Led the move of the billing platform to event sourcing'],
  certifications: ['AWS Certified Solutions Architect'],
};

const githubLink = { platform: 'GITHUB', url: 'https://github.com/ana-pop' };

const validBody = {
  domainId: '5a8c2e1f-4b7d-4e9a-8c3f-6d1e2b4a7c90',
  bio: 'Backend engineer with eight years in fintech.\nI mentor juniors on system design.',
  highlights,
  socialLinks: [
    { platform: 'LINKEDIN', url: 'https://www.linkedin.com/in/ana-pop' },
    githubLink,
  ],
};

const validateProfile = (body: object): Promise<unknown> =>
  createValidationPipe().transform(body, bodyMetadata);

const toSocialLinkDto = (socialLink: object): MentorSocialLinkDto =>
  Object.assign(new MentorSocialLinkDto(), socialLink);

describe('MentorProfileDto validation', () => {
  it('accepts a complete profile and trims the bio and every highlight', async () => {
    const untrimmedBody = {
      ...validBody,
      bio: `  ${validBody.bio} \n `,
      highlights: {
        ...highlights,
        workplaces: [' \tSenior backend engineer at Nordwave Software  '],
      },
    };
    const validHighlights = Object.assign(
      new MentorProfileHighlightsDto(),
      highlights,
    );
    const validSocialLinks = validBody.socialLinks.map(toSocialLinkDto);
    const validDto = Object.assign(new MentorProfileDto(), validBody, {
      highlights: validHighlights,
      socialLinks: validSocialLinks,
    });

    await expect(validateProfile(untrimmedBody)).resolves.toStrictEqual(
      validDto,
    );
  });

  it('accepts a profile without a domain or bio, with empty lists and no social links', async () => {
    const emptyHighlights = {
      workplaces: [],
      achievements: [],
      certifications: [],
    };
    const emptyBody = { highlights: emptyHighlights, socialLinks: [] };
    const validDto = Object.assign(new MentorProfileDto(), emptyBody, {
      highlights: Object.assign(
        new MentorProfileHighlightsDto(),
        emptyHighlights,
      ),
    });

    await expect(validateProfile(emptyBody)).resolves.toStrictEqual(validDto);
  });

  it.each([
    ['a domainId that is not a UUID', { domainId: 'marketing' }],
    ['a blank bio', { bio: ' \r\n\t ' }],
    [
      'a blank highlight item',
      { highlights: { ...highlights, achievements: [' \t '] } },
    ],
    [
      'highlights missing a list',
      {
        highlights: {
          workplaces: highlights.workplaces,
          achievements: highlights.achievements,
        },
      },
    ],
    [
      'an unknown social platform',
      { socialLinks: [{ ...githubLink, platform: 'MYSPACE' }] },
    ],
    [
      'a social link URL without a protocol',
      { socialLinks: [{ ...githubLink, url: 'github.com/ana-pop' }] },
    ],
  ])('rejects a profile with %s', async (_problem, changes) => {
    await expect(validateProfile({ ...validBody, ...changes })).rejects.toThrow(
      BadRequestException,
    );
  });
});
