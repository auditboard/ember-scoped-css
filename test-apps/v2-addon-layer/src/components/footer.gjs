import { concat } from '@ember/helper';

<template>
  <div class='alert' data-test3={{concat "test" (scoped-class '   my-class my-other-class  ')}} data-test2={{scoped-class '  my-class '}} data-test={{(scoped-class 'my-class')}}>
    <div>
      {{@title}}
    </div>
    <p>
      {{@message}}
    </p>
  </div>
</template>
