new Vue({
    el: '#app',
    data: {
        chat: {
            avatar: 'http://localhost:11673/avatar/KLKSMSGPUBLICCHAT',
            name: 'Public chat',
            receiver: 'public',
            discussion: {},
            info: {}
        },
        message: '',
        isSending: false,
        users: [],
        discussions: [],
        searchUsers: '',
        searchDiscussions: '',
        identity: '',
        renewConfirm: false,
        alias: ''
    },
    computed: {
        filteredUsers() {
            return this.users.filter(item => {
                if(item.nickname){
                    return item.nickname.toLowerCase().indexOf(this.searchUsers.toLowerCase()) > -1
                }
            })
        },
        filteredDiscussions() {
            return this.discussions.filter(item => {
                if(item.nickname){
                    return item.nickname.toLowerCase().indexOf(this.searchDiscussions.toLowerCase()) > -1
                }
            })
        }
    },
    mounted() {
        const app = this
        app.updateContacts()
        app.loadDiscussion('public')
        app.getDiscussions()
        setInterval(function () {
            app.loadDiscussion()
        }, 500)
    },
    methods: {
        updateContacts() {
            const app = this
            console.log('Updating contacts.')
            app.users = []
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
        getChatInfo(){
            const app = this
            axios.get('http://localhost:11673/info/' + app.chat.receiver).then(response => {
                app.chat.info = response.data
                app.chat.name = app.chat.info.nickname
                app.alias = app.chat.info.nickname
            })
        },
        loadDiscussion(what, id) {
            const app = this
            if(what === undefined){
                what = app.chat.receiver
                id = app.chat.address
            }
            if(what === 'public'){
                app.chat.receiver = 'public'
                app.chat.name = 'Public chat'
                app.chat.address = ''
                axios.get('http://localhost:11673/messages/public').then(response => {
                    app.chat.discussion = response.data
                    setTimeout(function () {
                        window.jQuery('#scroll').scrollTop(99999999999999999)
                    }, 10)
                })
            }else if(what === 'group'){
                
            } else {
                app.chat.receiver = id
                app.chat.address = id
                axios.get('http://localhost:11673/messages/address/' + id).then(response => {
                    app.chat.discussion = response.data
                    setTimeout(function () {
                        window.jQuery('#scroll').scrollTop(99999999999999999)
                    }, 10)
                })
            }
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
        },
        showIdentity(){
            const app = this
            axios.get('http://localhost:11673/identity').then(response => {
                app.identity = response.data
            })
        },
        copyIdentity(){
            const app = this
            this.$copyText(JSON.stringify(app.identity)).then(function (e) {
                console.log(e)
            }, function (e) {
                alert('Can not copy')
                console.log(e)
            })
        },
        confirmRenew(){
            const app = this 
            app.renewConfirm = true
        },
        renewKeys(){
            const app = this
            if(app.renewConfirm === true){
                axios.delete('http://localhost:11673/identity').then(response => {
                    app.renewConfirm = false
                    alert('Identity renewed!')
                })
            }
        },
        updateAlias(){
            const app = this
            axios.post('http://localhost:11673/contacts/update',{ address: app.chat.receiver, nickname: app.alias}).then(response => {
                alert('Contact updated!')
            })
        },
        confirmBlock(){
            const app = this
            if (confirm("Do you want to block this user?")) {
                axios.post('http://localhost:11673/contacts/block',{ address: app.chat.receiver}).then(response => {
                    if(response.data.success){
                        if(response.data.state){
                            alert('The contact is now blocked!')
                        }else{
                            alert('The contact is now unblocked!')
                        }
                    }
                })
            }
        }
    }
})