rule "synthetics-suite" {
  match {
    type = "datadog_synthetics_suite"
  }

  as = concept.synthetic-check
}

rule "synthetics-test" {
  match {
    type = "datadog_synthetics_test"
  }

  as = concept.synthetic-check

}

rule "synthetics-test-lookup" {
  match {
    kind = "data"
    type = "datadog_synthetics_test"
  }

  as = concept.synthetic-check
}
