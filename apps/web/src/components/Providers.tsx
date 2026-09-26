"use client";

import { Provider } from "react-redux";
import { makeStore } from "@/lib/redux/store";
import AuthListener from "@/components/AuthListener";
import { useRef } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const storeRef = useRef(makeStore());

  return (
    <Provider store={storeRef.current}>
      <AuthListener>
        {children}
      </AuthListener>
    </Provider>
  );
}
