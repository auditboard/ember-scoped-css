export const AttrScopedElement = <template>
  <button type="submit">submit</button>
  <style scoped>
    [type="submit"] {
      color: rgb(10, 20, 30);
    }
  </style>
</template>;

export default AttrScopedElement;
