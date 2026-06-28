import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import Lenis from "lenis";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import BotSection from "../components/BotSection";
import HowItWorks from "../components/HowItWorks";
import Marquee from "../components/Marquee";
import Contact from "../components/Contact";
import Footer from "../components/Footer";

gsap.registerPlugin(ScrollTrigger, Flip);

export default function Marketing() {
  useEffect(() => {
    const lenis = new Lenis();
    lenis.on("scroll", ScrollTrigger.update);

    const onTick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    const listenerCleanups = [];

    const ctx = gsap.context(() => {
      // ─── SUB-NAV HIGHLIGHT ───
      const items = [...document.querySelectorAll(".sub-nav-item")];
      const highlight = document.getElementById("highlight");
      let currentIdx = 0;

      function moveHighlightTo(idx) {
        const state = Flip.getState(highlight);
        items[idx].appendChild(highlight);
        Flip.from(state, { duration: 0.45, ease: "expo.out" });
      }

      items.forEach((item, idx) => {
        const onClick = () => lenis.scrollTo("#" + item.dataset.to, { duration: 1.2 });
        const onEnter = () => moveHighlightTo(idx);
        const onLeave = () => moveHighlightTo(currentIdx);

        item.addEventListener("click", onClick);
        item.addEventListener("mouseenter", onEnter);
        item.addEventListener("mouseleave", onLeave);

        listenerCleanups.push(() => {
          item.removeEventListener("click", onClick);
          item.removeEventListener("mouseenter", onEnter);
          item.removeEventListener("mouseleave", onLeave);
        });
      });

      function setActive(sectionId) {
        const match = items.findIndex((i) => i.dataset.to === sectionId);
        if (match > -1) {
          items[currentIdx].classList.remove("current");
          currentIdx = match;
          items[currentIdx].classList.add("current");
          moveHighlightTo(currentIdx);
        }
      }

      // Update active on scroll
      const sections = document.querySelectorAll("section[id], #marquee-strip");
      sections.forEach((sec) => {
        ScrollTrigger.create({
          trigger: sec,
          start: "top 40%",
          end: "bottom 40%",
          onEnter: () => setActive(sec.id),
          onEnterBack: () => setActive(sec.id),
        });
      });

      // ─── HERO TEXT STAGGER ───
      gsap.set(".hero-title .inner", { yPercent: 110 });
      gsap.set([".hero-label", ".hero-sub", ".hero-btn", ".scribble"], { opacity: 0 });

      const heroTl = gsap.timeline({ delay: 0.15 });
      heroTl
        .to(".hero-title .inner", {
          yPercent: 0,
          duration: 1,
          ease: "expo.out",
          stagger: 0.1,
        })
        .to(".hero-label", { opacity: 1, duration: 0.6, ease: "power2.out" }, "-=0.4")
        .to(".scribble", { opacity: 0.18, duration: 0.8, stagger: 0.15, ease: "power2.out" }, "-=0.5")
        .to(
          [".hero-sub", ".hero-btn"],
          { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.1 },
          "-=0.3",
        );

      // ─── SCROLL FADE UPS ───
      gsap.utils
        .toArray(".sec-header, .bot-step, .step-card, .bot-right, .contact-left, .contact-right")
        .forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 32,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%" },
          });
        });

      // ─── PHONE FLOAT ───
      gsap.to(".phone", {
        y: -12,
        duration: 3,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      // ─── SCRIBBLE ROTATION ───
      gsap.to(".scribble-mid", {
        rotation: 25,
        duration: 8,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    });

    return () => {
      listenerCleanups.forEach((cleanup) => cleanup());
      ctx.revert();
      gsap.ticker.remove(onTick);
      lenis.destroy();
    };
  }, []);

  return (
    <>
      <Navbar />
      <div className="scroll-wrapper">
        <Hero />
        <BotSection />
        <HowItWorks />
        <Marquee />
        <Contact />
        <Footer />
      </div>
    </>
  );
}
