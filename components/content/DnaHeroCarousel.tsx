"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/lib/ui-data";

const slides = [
  {
    label: "For the people who shaped your story",
    title: "A piece of their story, kept close.",
    description:
      "A personal sample becomes a real diamond — a way to carry someone you love close, every day.",
    image: "/images/dna-diamond-story.png",
    alt: "A woman holds her elderly mother's hand close to her heart beside a delicate diamond pendant",
  },
  {
    label: "For the person who feels like home",
    title: "Love, held close in a diamond.",
    description:
      "Celebrate the person you chose with a keepsake made from a personal sample — a little reminder of your bond, wherever life takes you.",
    image: "/images/dna-diamond-partner.png",
    alt: "A couple share a warm moment together, wearing a small diamond pendant",
  },
  {
    label: "For the ones who greet us at the door",
    title: "Their love leaves pawprints. Keep it close.",
    description:
      "Celebrate the bond you share with your dog with a diamond created from purified carbon derived from their sample.",
    image: "/images/dna-diamond-dog.png",
    alt: "A woman cuddles her golden retriever, both in a warm sunlit home",
  },
  {
    label: "For the quietest kind of comfort",
    title: "Every purr. Every little moment.",
    description:
      "Turn the connection you share with your cat into a personal keepsake you can carry with you.",
    image: "/images/dna-diamond-cat.png",
    alt: "A woman cuddles her cat close in a soft, sunlit home",
  },
];

export function DnaHeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);

  useEffect(() => {
    if (paused || interacting) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, interacting]);

  function showSlide(index: number) {
    setActiveIndex((index + slides.length) % slides.length);
  }

  const slide = slides[activeIndex];

  return (
    <section
      className="dna-hero"
      aria-label="DNA diamonds for the ones you love"
      aria-roledescription="carousel"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false);
      }}
    >
      {slides.map((item, index) => (
        <div className={`dna-hero__slide${index === activeIndex ? " is-active" : ""}`} key={item.image} aria-hidden={index !== activeIndex}>
          <Image src={item.image} alt={item.alt} fill priority={index === 0} sizes="100vw" className="dna-hero__image" />
        </div>
      ))}
      <div className="dna-hero__veil" aria-hidden="true" />
      <div className="dna-hero__content" key={slide.title}>
        <p className="dna-eyebrow">{slide.label}</p>
        <h1>{slide.title}</h1>
        <p className="dna-hero__intro">{slide.description}</p>
        <div className="dna-hero__actions">
          <Button href={WHATSAPP_URL} variant="primary">Ask us about DNA diamonds</Button>
          <a className="dna-text-link" href="#the-journey">Discover the journey <span aria-hidden>↓</span></a>
        </div>
        <p className="dna-hero__reassurance">For a person or pet you love. A keepsake made to stay close.</p>
      </div>
      <div className="dna-carousel-controls">
        <button type="button" className="dna-carousel-arrow" onClick={() => showSlide(activeIndex - 1)} aria-label="Previous banner">←</button>
        <div className="dna-carousel-dots" aria-label="Choose a banner">
          {slides.map((item, index) => (
            <button
              key={item.image}
              type="button"
              className={`dna-carousel-dot${index === activeIndex ? " is-active" : ""}`}
              aria-label={`Show banner ${index + 1}: ${item.label}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => showSlide(index)}
            />
          ))}
        </div>
        <span className="dna-carousel-count">0{activeIndex + 1} <span aria-hidden>/</span> 0{slides.length}</span>
        <button
          type="button"
          className="dna-carousel-arrow dna-carousel-toggle"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? "Resume automatic banner changes" : "Pause automatic banner changes"}
          title={paused ? "Play" : "Pause"}
        >
          {paused ? "▶" : "Ⅱ"}
        </button>
        <button type="button" className="dna-carousel-arrow" onClick={() => showSlide(activeIndex + 1)} aria-label="Next banner">→</button>
      </div>
    </section>
  );
}
