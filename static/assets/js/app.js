new Vue({
    el: '#app',
    data: {
      message: 'Hello Vue!',
      chat: {
          avatar: 'http://localhost:11673/avatar/KLKSMSGPUBLICCHAT',
          name: 'Public chat',
          discussion: {}
      }
    },
    mounted() {
        const app = this
        axios.get('http://localhost:11673/messages/public').then(response => {
            app.chat.discussion = response.data
        })
    }
})