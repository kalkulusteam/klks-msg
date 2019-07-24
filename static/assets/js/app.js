new Vue({
    el: '#app',
    data: {
        chat: {
            avatar: 'http://localhost:11673/avatar/KLKSMSGPUBLICCHAT',
            name: 'Public chat',
            receiver: 'public',
            discussion: {}
        },
        message: '',
        isSending: false,
        users: {},
        discussions: {}
    },
    mounted() {
        const app = this
        app.updateContacts()
        app.getPublicChat()
        app.getDiscussions()
        setInterval(function () {
            app.getPublicChat()
        }, 500)
    },
    methods: {
        updateContacts() {
            const app = this
            console.log('Updating contacts.')
            app.users = {}
            setTimeout(function () {
                axios.get('http://localhost:11673/contacts').then(response => {
                    app.users = response.data
                })
            }, 10)
        },
        getDiscussions() {
            const app = this
            axios.get('http://localhost:11673/discussions').then(response => {
                app.discussions = response.data
            })
        },
        getPublicChat() {
            const app = this
            axios.get('http://localhost:11673/messages/public').then(response => {
                app.chat.discussion = response.data
                setTimeout(function () {
                    window.jQuery('#scroll').scrollTop(99999999999999999)
                }, 10)
            })
        },
        sendMessage() {
            const app = this
            if (app.isSending === false && app.message !== '') {
                app.isSending = true
                axios.post('http://localhost:11673/message', {
                    message: app.message,
                    receiver: app.chat.receiver
                }).then(response => {
                    app.message = ''
                    app.getPublicChat()
                    app.isSending = false
                }).catch(err => {
                    app.isSending = false
                })
            }
        }
    }
})