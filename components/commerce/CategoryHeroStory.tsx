"use client";

import { useMemo } from "react";
import type { CategoryStory } from "@/lib/category-stories";

type CategoryHeroStoryProps = {
  story: CategoryStory;
};

function StoryLine({ text }: { text: string }) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  return (
    <span className="plp-hero__story-line">
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="plp-hero__story-word"
          style={{ animationDelay: `${index * 0.18}s` }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

export function CategoryHeroStory({ story }: CategoryHeroStoryProps) {
  const lines = [story.line1, story.line2].map((t) => t?.trim()).filter(Boolean) as string[];

  return (
    <div className="plp-hero__story" aria-live="polite">
      {lines.map((text) => (
        <p key={text} className="plp-hero__story-row">
          <StoryLine text={text} />
        </p>
      ))}
    </div>
  );
}

