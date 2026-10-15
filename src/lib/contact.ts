export const contactEmail = import.meta.env.VITE_CONTACT_EMAIL?.trim() || 'hello@figuredit.in';
export const contactHref = `mailto:${contactEmail}`;
