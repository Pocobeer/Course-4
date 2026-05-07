#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <pthread.h>
#include <time.h> 

#define CAPACITY 3          // кабинки
#define STREAK_LIMIT 5      
#define TOTAL_STUDENTS 20      

#define MIN_WASH_TIME 1     
#define MAX_WASH_TIME 5     

typedef enum { MALE = 0, FEMALE = 1 } gender_t;
#define GENDER_NAME(g) ((g) == MALE ? "мужчина" : "женщина")

typedef enum { EMPTY, MEN_INSIDE, WOMEN_INSIDE } bath_state_t;

typedef struct {
    pthread_mutex_t mutex;
    pthread_cond_t cond;

    int capacity;               
    int occupied;               
    bath_state_t bath_gender;    // кто внутри 

    int streak_gender;          
    int streak_used;             
    int streak_limit;            

    int remaining_male;
    int remaining_female;

    // Статистика 
    long total_wait_time;     
    long total_bath_time;      
    int entered_count;          
    int male_entered, female_entered;

    int verbose;
} bath_t;

bath_t bath;

void bath_init(bath_t *b, int cap, int streak_limit) {
    pthread_mutex_init(&b->mutex, NULL);
    pthread_cond_init(&b->cond, NULL);
    b->capacity = cap;
    b->occupied = 0;
    b->bath_gender = EMPTY;
    b->streak_gender = -1;
    b->streak_used = 0;
    b->streak_limit = streak_limit;
    b->remaining_male = 0;
    b->remaining_female = 0;
    b->total_wait_time = 0;
    b->total_bath_time = 0;
    b->entered_count = 0;
    b->male_entered = 0;
    b->female_entered = 0;
    b->verbose = 1;
}

void print_status(bath_t *b, const char *event, int id, gender_t g) {
    if (!b->verbose) return;
    printf("%s: студент %d (%s), занято %d/%d, внутри %s, стрик: %s %d/%d, осталось: M=%d, Ж=%d\n",
           event, id, GENDER_NAME(g),
           b->occupied, b->capacity,
           (b->bath_gender == EMPTY ? "пусто" :
            (b->bath_gender == MEN_INSIDE ? "мужчины" : "женщины")),
           (b->streak_gender == -1 ? "не определён" : GENDER_NAME(b->streak_gender)),
           b->streak_used, b->streak_limit,
           b->remaining_male, b->remaining_female);
}

int can_enter(bath_t *b, gender_t g) {
    if (b->occupied >= b->capacity) return 0;

    if (b->occupied == 0) {
        if (b->streak_gender == -1) return 1;  // любой пол разрешён

        int allowed = (b->streak_used < b->streak_limit) ? b->streak_gender : !b->streak_gender;
        if (g == allowed) return 1;

        // Если разрешённый пол отсутствует, сбрасываем стрик, чтобы пустить любой пол
        if ((allowed == MALE && b->remaining_male == 0) || (allowed == FEMALE && b->remaining_female == 0)) {
            b->streak_gender = -1;
            b->streak_used = 0;
            return 1; 
        }
        return 0;
    } else {
        // Ванная занята – только тот же пол
        if (b->bath_gender == MEN_INSIDE && g != MALE) return 0;
        if (b->bath_gender == WOMEN_INSIDE && g != FEMALE) return 0;
        // Проверяем лимит серии
        int allowed = (b->streak_used < b->streak_limit) ? b->streak_gender : !b->streak_gender;
        return (g == allowed);
    }
}

void bath_enter(bath_t *b, int id, gender_t g, time_t *wait_start) {
    pthread_mutex_lock(&b->mutex);
    
    while (!can_enter(b, g)) {
        pthread_cond_wait(&b->cond, &b->mutex);
    }

    time_t now = time(NULL);
    long wait_sec = now - *wait_start;
    b->total_wait_time += wait_sec;

    b->occupied++;
    if (b->occupied == 1) {
        b->bath_gender = (g == MALE) ? MEN_INSIDE : WOMEN_INSIDE;
    }

    if (g == MALE) b->remaining_male--; else b->remaining_female--;

    // Обновляем стрик
    if (b->streak_gender == -1) {
        b->streak_gender = g;
        b->streak_used = 1;
    } else if (g == b->streak_gender) {
        b->streak_used++;
    } else {
        b->streak_gender = g;
        b->streak_used = 1;
    }

    print_status(b, "ВХОД", id, g);
    pthread_mutex_unlock(&b->mutex);
}

void bath_leave(bath_t *b, int id, gender_t g, long bath_sec) {
    pthread_mutex_lock(&b->mutex);

    b->occupied--;
    b->total_bath_time += bath_sec;
    b->entered_count++;
    if (g == MALE) b->male_entered++; else b->female_entered++;

    if (b->occupied == 0) {
        b->bath_gender = EMPTY;
    }

    print_status(b, "ВЫХОД", id, g);

    pthread_cond_broadcast(&b->cond);
    pthread_mutex_unlock(&b->mutex);
}

void* student_thread(void *arg) {
    int id = *((int*)arg);
    free(arg);

    gender_t gender;
    if (rand() % 100 < 50)
        gender = MALE;
    else
        gender = FEMALE;

    pthread_mutex_lock(&bath.mutex);
    if (gender == MALE) bath.remaining_male++; else bath.remaining_female++;
    pthread_mutex_unlock(&bath.mutex);

    int wash_time = MIN_WASH_TIME + rand() % (MAX_WASH_TIME - MIN_WASH_TIME + 1);

    time_t wait_start = time(NULL);
    bath_enter(&bath, id, gender, &wait_start);

    time_t bath_start = time(NULL);
    sleep(wash_time);
    time_t bath_end = time(NULL);
    long bath_sec = bath_end - bath_start;

    bath_leave(&bath, id, gender, bath_sec);

    return NULL;
}

int main() {
    srand(time(NULL));

    bath_init(&bath, CAPACITY, STREAK_LIMIT);

    pthread_t threads[TOTAL_STUDENTS];

    for (int i = 0; i < TOTAL_STUDENTS; i++) {
        int *id = malloc(sizeof(int));
        *id = i;
        pthread_create(&threads[i], NULL, student_thread, id);
        usleep(100000);
    }

    for (int i = 0; i < TOTAL_STUDENTS; i++) {
        pthread_join(threads[i], NULL);
    }

    pthread_mutex_lock(&bath.mutex);
    printf("\nСТАТИСТИКА\n");
    printf("Всего студентов: %d\n", TOTAL_STUDENTS);
    printf("Мужчин вошло: %d, женщин: %d\n", bath.male_entered, bath.female_entered);
    double avg_wait = (bath.entered_count > 0) ?
        (double)bath.total_wait_time / bath.entered_count : 0;
    double avg_bath = (bath.entered_count > 0) ?
        (double)bath.total_bath_time / bath.entered_count : 0;
    printf("Среднее время ожидания: %.3f сек\n", avg_wait);
    printf("Среднее время в ванной: %.3f сек\n", avg_bath);
    pthread_mutex_unlock(&bath.mutex);

    return 0;
}
