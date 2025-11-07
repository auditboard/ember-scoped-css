import { concat } from '@ember/helper';

import {scopedClass} from 'ember-scoped-css';

<template>
  <div class='alert' data-test3={{concat "test" (scopedClass '   my-class my-other-class  ')}} data-test2={{scopedClass '  my-class '}} data-test={{(scopedClass 'my-class')}}>
    <div>
      {{@title}}
    </div>
    <p>
      {{@message}}
    </p>
  </div>
</template>
