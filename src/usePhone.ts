import { isPhoneWidth } from "./lib";
import { useEffect, useState } from "react";

/** True at phone width (spec: screens.md#top-bar-one-row-fixed-height, phones ≤ 760 px): one-column board, Reshuffle pinned to the bottom. */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => isPhoneWidth(window.innerWidth));
  useEffect(() => {
    const onResize = () => setPhone(isPhoneWidth(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return phone;
}
