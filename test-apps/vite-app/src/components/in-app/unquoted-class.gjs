const yes = true;
const no = false;

<template>
  <p data-test-chosen class={{if yes "chosen" "other"}}>chosen</p>
  <p data-test-fallback class={{if no "chosen" "other"}}>fallback</p>
  <p data-test-global class={{if yes "not-in-css"}}>global</p>
</template>
