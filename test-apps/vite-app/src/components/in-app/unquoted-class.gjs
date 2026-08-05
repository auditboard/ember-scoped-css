const yes = true;
const no = false;
const eq = (a, b) => a === b;
const mode = 'chosen';

<template>
  <p data-test-chosen class={{if yes "chosen" "other"}}>chosen</p>
  <p data-test-fallback class={{if no "chosen" "other"}}>fallback</p>
  <p data-test-global class={{if yes "not-in-css"}}>global</p>
  <p
    data-test-comparand
    class={{if (eq mode "chosen") "chosen" "other"}}
  >comparand</p>
</template>
