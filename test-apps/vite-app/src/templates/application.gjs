import WithClass from '../components/with-class.gjs';
import Third from '../components/third.gjs';
import Forth from '../components/forth.gjs';
import { ScopedFoo, ScopedInlineFoo } from '../components/in-app/scoped.gjs';
import InAppBasic from '../components/in-app/basic.gts';
import InAppCallsAtClass from '../components/in-app/at-class-ts/calls-has-at-class.gts';

const Frame = <template>
    <fieldset>
        <legend>{{@name}}</legend>
        
        {{yield}}
    </fieldset>
</template>;


const components = { WithClass, Third, Forth, ScopedFoo, ScopedInlineFoo, InAppBasic, InAppCallsAtClass };


<template>
    <div>
    {{#each-in components as |ComponentName Component|}}
        <Frame @name={{ComponentName}}>
            <Component @title="title arg" @message="This is a message." />
        </Frame>
    {{/each-in}}
    </div>

    <style scoped>
        div {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        }
    </style>
</template>