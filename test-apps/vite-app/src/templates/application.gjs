import Forth from '../components/forth';
import { ScopedFoo } from '../components/in-app/scoped';

<template>
  Hello World

  <Forth @title="Hello There" @message="General Kenobi" />

  <ScopedFoo />
</template>
