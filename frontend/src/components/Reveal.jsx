import { useEffect, useRef, useState } from "react";

const SUPPORTS_IO = typeof IntersectionObserver !== "undefined";

/**
 * Reveals children once they scroll into view. The resting state in CSS is the
 * visible one; the hidden state only applies while `data-armed` is set, so if
 * this never runs the content is on screen rather than stranded at opacity 0.
 * Reduced-motion users skip the transition entirely (handled in CSS).
 */
export default function Reveal({ children, delay = 0, variant, as: Tag = "div", className = "", ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(!SUPPORTS_IO);

  useEffect(() => {
    if (!SUPPORTS_IO) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Fire a little before the element is fully on screen so the motion has
      // finished settling by the time it reaches the middle of the viewport.
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const classes = ["reveal", variant ? `reveal-${variant}` : "", visible ? "is-visible" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      ref={ref}
      className={classes}
      data-armed={visible ? undefined : ""}
      style={delay ? { "--reveal-delay": `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
