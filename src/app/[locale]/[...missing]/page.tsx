import { notFound } from "next/navigation";

// Always throws, so there is no shell to validate for instant navigation.
export const instant = false;

/** Any unmatched `/{locale}/…` URL: render the branded 404 inside the site layout (with a real 404 status). */
export default function MissingPage() {
  notFound();
}
