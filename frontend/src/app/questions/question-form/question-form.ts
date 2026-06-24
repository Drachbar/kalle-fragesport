import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormArray,
  FormControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  QuestionsService,
  type QuestionInput,
  type QuestionType,
} from '../questions.service';
import { controlError } from '../../shared/form-errors';

/** ISO-datum/tidsstämpel → 'YYYY-MM-DD' för ett date-input; tomt om null. */
function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

/** Tomt date-input → null, annars värdet oförändrat. */
function fromDateInput(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Component({
  selector: 'app-question-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './question-form.html',
  styleUrl: './question-form.css',
})
export class QuestionForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly questionsService = inject(QuestionsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly id = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    question: ['', Validators.required],
    answer: ['', Validators.required],
    type: this.fb.nonNullable.control<QuestionType>(
      'multiple_choice',
      Validators.required,
    ),
    category: [''],
    autoUpdate: [false],
    updateIntervalDays: [30, [Validators.required, Validators.min(1)]],
    earliestUpdateAt: [''],
    answerAsOf: [''],
    options: new FormArray<FormControl<string>>([]),
  });

  get options(): FormArray<FormControl<string>> {
    return this.form.controls.options;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.id.set(id);
    this.questionsService.get(id).subscribe((question) => {
      this.form.patchValue({
        question: question.question,
        answer: question.answer,
        type: question.type,
        category: question.category ?? '',
        autoUpdate: question.autoUpdate,
        updateIntervalDays: question.updateIntervalDays,
        earliestUpdateAt: toDateInput(question.earliestUpdateAt),
        answerAsOf: toDateInput(question.answerAsOf),
      });
      this.options.clear();
      for (const option of question.options) {
        this.addOption(option);
      }
      this.cdr.markForCheck();
    });
  }

  protected isInvalid(control: 'question' | 'answer'): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }

  protected errorFor(control: 'question' | 'answer'): string | null {
    return controlError(this.form.controls[control]);
  }

  protected addOption(value = ''): void {
    this.options.push(new FormControl(value, { nonNullable: true }));
  }

  protected removeOption(index: number): void {
    this.options.removeAt(index);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.submitting.set(true);
    const raw = this.form.getRawValue();
    const category = raw.category.trim();
    const input: QuestionInput = {
      question: raw.question.trim(),
      answer: raw.answer.trim(),
      type: raw.type,
      category: category.length > 0 ? category : null,
      autoUpdate: raw.autoUpdate,
      updateIntervalDays: raw.updateIntervalDays,
      earliestUpdateAt: fromDateInput(raw.earliestUpdateAt),
      answerAsOf: fromDateInput(raw.answerAsOf),
      options: raw.options
        .map((option) => option.trim())
        .filter((option) => option.length > 0),
    };

    const id = this.id();
    const request = id
      ? this.questionsService.update(id, input)
      : this.questionsService.create(input);

    request.subscribe({
      next: () => this.router.navigateByUrl('/questions'),
      error: (_err: HttpErrorResponse) => {
        this.error.set('Kunde inte spara frågan');
        this.submitting.set(false);
      },
    });
  }
}
