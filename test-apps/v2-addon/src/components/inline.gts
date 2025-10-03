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
</template>
