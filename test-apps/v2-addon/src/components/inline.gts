export default <template>
  <h1>Time</h1>

  <style scoped>
    h1 { color: rgb(0, 0, 200); }
  </style>
  <style>
    @layer firstLayer {
      h1 { color: rgb(0, 200, 0); }
    }
  </style>
</template>;


export const SecondScoped = <template>
  <h1>Second Scoped</h1>

  <style scoped>
    h1 { color: rgb(200, 0, 200); }
  </style>
</template>;


export const ActuallyInline = <template>
  <h1>Actually Inline</h1>

  <style scoped inline>
    h1 { color: rgb(200, 0, 0); }
  </style>
</template>