import { init } from "@plausible-analytics/tracker";
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

// Only initialize Plausible on the client side to avoid SSR issues
if (ExecutionEnvironment.canUseDOM) {
  init({
    domain: "docs.shinzo.network",
  });
}
