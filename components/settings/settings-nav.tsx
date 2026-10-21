"use client";

import { useEffect, useState } from "react";

/**
 * The sections of the settings page.
 *
 * A settings page that is one long column of forms is a form, not a place:
 * a reader who wants to change their picture has to scroll past the password
 * field to find out whether it is there. The list on the left says what can
 * be changed, and the one you are in is lit.
 *
 * The lit one is decided by what is on the screen, not by what was clicked:
 * a section that is being read is the one that is lit, and scrolling moves
 * the light with you.
 */
export function SettingsNav({
  sections,
}: {
  sections: { id: string; title: string; description: string }[];
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const nodes = sections
      .map((section) => document.getElementById(section.id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 }
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Settings sections" className="sticky top-6 space-y-0.5">
      {sections.map((section) => {
        const on = section.id === active;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={on ? "true" : undefined}
            className={`block rounded-lg px-3 py-2 transition-colors duration-150 ${
              on
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            <span className="block text-sm font-medium">{section.title}</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              {section.description}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
