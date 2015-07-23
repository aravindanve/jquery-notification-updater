(function($, win) {
    // exit if jquery not available
    if (typeof $ != 'function') {
        console.log("Error: jQuery Required");
        return false;
    }

    if (typeof win.NotificationUpdater2 != 'object')
        win.NotificationUpdater2 = {};

    // default settings 
    var def_settings = {
        'url':                          '',
        'target_class_name':            'notification-panel-43675753',
        'csrf_token':                   false,
        'notification_badge_container': 'nf-badge-container',
        'notification_badge_class':     'nf-badge',
        'empty_notifications_markup':   '<li class="nf-placeholder">You have no notifications.</li>',
        'load_more_class':              'load-more',
        'std_notif_length':             8, // no of notificatiosn returned
        'refresh_interval':             10, // in seconds
        'idle_stepper_interval':        20,
        'sleep_time':                   120,
        'paused':                       false,
        'enable_logging':               true,
    };

    // load settings
    if (typeof win.NotificationUpdater2.settings != 'object')
        win.NotificationUpdater2.settings = def_settings;
    else {
        for (key in def_settings) 
            if (def_settings.hasOwnProperty(key)) {
            if (typeof win.NotificationUpdater2.settings[key] == 'undefined')
                win.NotificationUpdater2.settings[key] = def_settings[key];
        }
    }

    // timer data object
    win.NotificationUpdater2.timer = {};
    /* win.NotificationUpdater2.timer.countdown_timer = 
        win.NotificationUpdater2.settings.refresh_interval; */
    win.NotificationUpdater2.timer.countdown_timer = 1;
    win.NotificationUpdater2.timer.idle_time = 0;
    win.NotificationUpdater2.timer.sleeping = false;

    // response data object
    win.NotificationUpdater2.data = {};
    win.NotificationUpdater2.data.raw = null;
    win.NotificationUpdater2.data.first_id = win.NotificationUpdater2.data.first_id || 0;
    win.NotificationUpdater2.data.last_id = win.NotificationUpdater2.data.last_id || 0;
    win.NotificationUpdater2.data.unread_count = win.NotificationUpdater2.data.unread_count || 0;
    win.NotificationUpdater2.data.read_all = false;

    function show_error(txt) {
        console.log("%c" + "Error: " + txt, "color: #F30;");
    }

    win.NotificationUpdater2.process_response = function(response) { 
        // acquire lock
        if (win.NotificationUpdater2.locked) return false;
        win.NotificationUpdater2.locked = true;
        // stash response
        win.NotificationUpdater2.data.raw = response;

        // handle response
        if (typeof response != 'undefined') {

            if (typeof response.okay == 'undefined') {
                show_error("missing attribute 'okay' in response, halting.");
            }
            else if (typeof response.notifications == 'undefined') {
                show_error("missing attribute 'notifications' in response, halting.");
            }
            else {
                var l = win.NotificationUpdater2.settings;
                // process response
                var last_id = win.NotificationUpdater2.data.last_id;
                var first_id = win.NotificationUpdater2.data.first_id;
                var nf_container = $('.' + l.target_class_name);
                var count = 0;
                if (!response.last_id && !response.first_id) {
                    nf_container.empty();
                } else {
                    if (response.first_id) first_id = response.first_id;
                }
                // set read 
                if (response.read_all) {
                    nf_container.children().each(function() {
                        $(this).removeClass('unread');
                    });
                }
                // add notifications
                if (response.notifications.length) {
                    /* var template = {
                        "okay": true,
                        "notifications": [{"id": 21, "markup": "<a href...></a>","unread": false},],
                        "last_id": 20,
                        "first_id": 12,
                    }; */
                    // always notifications received are excluding first_id
                    if (response.first_id) {
                        // clear elements before first_id
                        nf_container.children().each(function() {
                            var real_slug = $(this);
                            var temp_id = real_slug.data('slug-id');
                            if (temp_id) {
                                if (parseInt(temp_id) < first_id) {
                                    real_slug.remove();
                                }
                            }
                        });
                    }
                    // append
                    for (var i = 0; i < response.notifications.length; i++) {
                        var slug = response.notifications[i];
                        var markup = slug.markup;
                        if (response.first_id) { 
                            nf_container.append(markup);
                            nf_container.children().last().attr('data-slug-id', slug.id); 
                        }
                        else {  
                            nf_container.prepend(markup);
                            nf_container.children().first().attr('data-slug-id', slug.id);
                        }
                        if (slug.unread) {
                            win.NotificationUpdater2.data.unread_count++;
                            if (response.first_id) { nf_container.children().last().addClass('unread'); }
                            else { nf_container.children().first().addClass('unread'); }
                        }
                        // last & first id
                        if ((!first_id) || (first_id > slug.id)) first_id = slug.id;
                        if (last_id < slug.id) last_id = slug.id;
                        count++;
                    }
                }
                // save first last id
                win.NotificationUpdater2.data.first_id = first_id;
                win.NotificationUpdater2.data.last_id = last_id;

                if (win.NotificationUpdater2.settings.enable_logging)
                    console.log(count + ' notifications added');
                // if no notifications
                if (!nf_container.children().length) {
                    nf_container.append(l.empty_notifications_markup);
                    nf_container.siblings('.'+l.load_more_class).remove();
                } else if ((response.notifications.length == 0) && (response.first_id)) {
                    nf_container.siblings('.'+l.load_more_class).unbind('click')
                        .empty().append('<p style="text-align: center; padding: 20px 0;">no more notifications</p>');
                } else if ((response.notifications.length < l.std_notif_length) && (!response.last_id)) {
                    nf_container.siblings('.'+l.load_more_class).unbind('click')
                        .empty().append('<p style="text-align: center; padding: 20px 0;">no more notifications</p>');
                }
                // update unread badge
                var badge_elem = $('.'+l.notification_badge_container)
                    .children('.'+l.notification_badge_class).first();
                if (typeof response.unread_count == 'number') {
                    win.NotificationUpdater2.data.unread_count = response.unread_count;
                } 
                if (win.NotificationUpdater2.data.unread_count) {
                    if (badge_elem.hasClass('hidden')) badge_elem.removeClass('hidden');
                    badge_elem.empty().append(win.NotificationUpdater2.data.unread_count);
                } else {
                    if (!badge_elem.hasClass('hidden')) badge_elem.addClass('hidden');
                    badge_elem.empty().append('0');
                }
            } 
        } else {
            show_error("response undefined");
        }
        // release lock 
        win.NotificationUpdater2.locked = false;
    };
    win.NotificationUpdater2.ajax_error = function(xhr, text_status, thrown_error) {
        if (win.NotificationUpdater2.settings.enable_logging)
            console.log(xhr);
        show_error(text_status);
    };
    win.NotificationUpdater2.run_update = function() {
        var cdt = win.NotificationUpdater2.timer.countdown_timer;
        if (win.NotificationUpdater2.settings.enable_logging) {
            console.log('[NotificationUpdater2] countdown: ' + cdt);
        }
        if (cdt < 1) {
            // update
            if (!win.NotificationUpdater2.settings.paused &&
                !win.NotificationUpdater2.timer.sleeping) {
                // send data
                var send_data = null;
                if (win.NotificationUpdater2.data.last_id) {
                    send_data = { last_id: win.NotificationUpdater2.data.last_id };
                    if (win.NotificationUpdater2.data.read_all) {
                        win.NotificationUpdater2.data.read_all = false;
                        send_data.read_all = true;
                    }
                }

                // csrf token
                if (win.NotificationUpdater.settings.csrf_token) {
                    if ((typeof send_data == 'object') && (send_data != null)) {
                        send_data['_token'] = win.NotificationUpdater.settings.csrf_token;
                    } else {
                        send_data = { '_token': win.NotificationUpdater.settings.csrf_token };
                    }
                }
                //send_data = $.param(send_data);
                // ajax
                if (win.NotificationUpdater2.settings.url.length) {
                    $.ajax({
                        url: win.NotificationUpdater2.settings.url,
                        type: 'GET',
                        data: send_data,
                        dataType: 'json',
                        success: win.NotificationUpdater2.process_response,
                        error: win.NotificationUpdater2.ajax_error,
                    });
                } else {
                    if (win.NotificationUpdater2.settings.enable_logging)
                        console.log('[NotificationUpdater2] url not set');
                }

                // log
                if (win.NotificationUpdater2.settings.enable_logging)
                    console.log('[NotificationUpdater2] update run');
            }
            if (win.NotificationUpdater2.settings.enable_logging &&
                win.NotificationUpdater2.timer.sleeping)
                    console.log('[NotificationUpdater2] timer sleeping...');
            // reset countdown
            win.NotificationUpdater2.timer.countdown_timer = 
                win.NotificationUpdater2.settings.refresh_interval * (parseInt(
                    win.NotificationUpdater2.timer.idle_time/
                        win.NotificationUpdater2.settings.idle_stepper_interval) + 1);
        } else {
            // count down
            win.NotificationUpdater2.timer.countdown_timer--;
            // step up idle time
            win.NotificationUpdater2.timer.idle_time++;
            // put to sleep if idle for too long
            if (win.NotificationUpdater2.timer.idle_time >
                win.NotificationUpdater2.settings.sleep_time) {
                win.NotificationUpdater2.timer.sleeping = true;
            }
        }
        setTimeout(win.NotificationUpdater2.run_update, 1000);
    };
    win.NotificationUpdater2.load_earlier = function() {
        // acquire lock
        win.NotificationUpdater2.load_earlier_lock_tries =  win.NotificationUpdater2.load_earlier_lock_tries || 0;
        if (win.NotificationUpdater2.locked) {
            if (win.NotificationUpdater2.load_earlier_lock_tries < 10) {
                win.NotificationUpdater2.load_earlier_lock_tries++;
                return setTimeout(function() {win.NotificationUpdater2.load_earlier();}, 500);
            } else {
                return false;
            }
        }
        win.NotificationUpdater2.locked = true;

        // send data
        var send_data = null;
        if (win.NotificationUpdater2.data.first_id) {
            send_data = { first_id: win.NotificationUpdater2.data.first_id };
        }
        // ajax
        if (win.NotificationUpdater2.settings.url.length) {
            $.ajax({
                url: win.NotificationUpdater2.settings.url,
                type: 'GET',
                data: send_data,
                dataType: 'json',
                success: win.NotificationUpdater2.process_response,
                error: win.NotificationUpdater2.ajax_error,
            });
        } else {
            if (win.NotificationUpdater2.settings.enable_logging)
                console.log('[NotificationUpdater2] url not set');
        }

        // log
        if (win.NotificationUpdater2.settings.enable_logging)
            console.log('[NotificationUpdater2] update run');
        // release lock
        win.NotificationUpdater2.locked = false;
        return true;
    };
    win.NotificationUpdater2.clear_idle_time = function() {
        // update if idle for too long
        if (win.NotificationUpdater2.timer.sleeping) {
            win.NotificationUpdater2.timer.sleeping = false;
            win.NotificationUpdater2.timer.countdown_timer = 2;
            if (win.NotificationUpdater2.settings.enable_logging)
                console.log('[NotificationUpdater2] timer woke up!');
        }
        else if (win.NotificationUpdater2.timer.countdown_timer > 
            win.NotificationUpdater2.settings.refresh_interval) {
            win.NotificationUpdater2.timer.countdown_timer = 2;
            if (win.NotificationUpdater2.settings.enable_logging)
                console.log('[NotificationUpdater2] activity interrupt');
        }
        // reset idle time
        win.NotificationUpdater2.timer.idle_time = 0;
    };

    // user functions
    win.NotificationUpdater2.fn = {};
    win.NotificationUpdater2.fn.mark_all_as_read = function() {
        win.NotificationUpdater2.data.read_all = true;
        if (win.NotificationUpdater2.settings.enable_logging)
            console.log('[NotificationUpdater2] marking all as read');
        win.NotificationUpdater2.fn.force_update();
    };
    win.NotificationUpdater2.fn.force_update = function() {
        // reset
        if (win.NotificationUpdater2.settings.enable_logging)
            console.log('[NotificationUpdater2] force update');
        win.NotificationUpdater2.timer.sleeping = false;
        win.NotificationUpdater2.timer.countdown_timer = 0;
        win.NotificationUpdater2.timer.idle_time = 0;
    };

    // on activity
    $("body").mousemove(function (e) { win.NotificationUpdater2.clear_idle_time(); });
    $("body").keypress(function (e) { win.NotificationUpdater2.clear_idle_time(); });

    // start updater
    win.NotificationUpdater2.run_update();


})(jQuery, window);

// separate for performance reasons, not part of notification updater
// setup notification auto load-more

(function($, win) {
    // exit if jquery not available
    if (typeof $ != 'function') {
        console.log("Error: jQuery Required");
        return false;
    }
    function notification_load_more(evt) {
        win.NotificationUpdater2.load_earlier();
        $('#notification-panel-wrapper')
            .children('.load-more').children('a')
            .empty().append('load more');
    }
    $(win).load(function() {
        $('#notification-panel-wrapper')
            .children('.load-more').children('a')
            .on('click', notification_load_more);
        $('#mark-all-as-read').on('click', function() {
            win.NotificationUpdater2.fn.mark_all_as_read();
        });
    });
})(jQuery, window);


