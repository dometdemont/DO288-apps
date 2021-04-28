/*
Copyright 2021.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package controllers

import (
	"context"
	"github.com/ghodss/yaml"
	"github.com/go-logr/logr"
	templatev1 "github.com/openshift/api/template/v1"
	"io/ioutil"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"net/http"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"strings"

	cmshpecomv1alpha1 "github.com/dometdemont/hpe5gcs-operator/api/v1alpha1"
)

// HPE5gcsAppReconciler reconciles a HPE5gcsApp object
type HPE5gcsAppReconciler struct {
	client.Client
	Log    logr.Logger
	Scheme *runtime.Scheme
}

// +kubebuilder:rbac:groups=cms.hpe.com,resources=hpe5gcsapps,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=cms.hpe.com,resources=hpe5gcsapps/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=cms.hpe.com,resources=hpe5gcsapps/finalizers,verbs=update
// +kubebuilder:rbac:groups=template.openshift.io,resources=templates,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=template.openshift.io,resources=templateconfigs,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=template.openshift.io,resources=templateinstances,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups="",resources=secrets,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=coordination.k8s.io,resources=leases,verbs=get;list;create;update

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
// TODO(user): Modify the Reconcile function to compare the state specified by
// the HPE5gcsApp object against the actual cluster state, and then
// perform operations to make the cluster state reflect the state specified by
// the user.
//
// For more details, check Reconcile and its Result here:
// - https://pkg.go.dev/sigs.k8s.io/controller-runtime@v0.7.2/pkg/reconcile

// Reference about managing templates in an operator: 
// https://miminar.fedorapeople.org/_preview/openshift-enterprise/registry-redeploy/go_client/instantiating_templates.html

func (r *HPE5gcsAppReconciler) Reconcile(context context.Context, request ctrl.Request) (ctrl.Result, error) {
	_ = r.Log.WithValues("hpe5gcsapp", request.NamespacedName)

	reqLogger := r.Log.WithValues("Request.Namespace", request.Namespace, "Request.Name", request.Name)
	reqLogger.Info("Reconciling HPE5gcsApp")

	// Fetch the HPE5gcsApp instance
	instance := &cmshpecomv1alpha1.HPE5gcsApp{}
	err := r.Get(context, request.NamespacedName, instance)
	if err != nil {
		if errors.IsNotFound(err) {
			// Request object not found, could have been deleted after reconcile request.
			// Owned objects are automatically garbage collected. For additional cleanup logic use finalizers.
			// Return and don't requeue
			return ctrl.Result{}, nil
		}
		// Error reading the object - requeue the request.
		return ctrl.Result{}, err
	}
	reqLogger.Info("Adding the template type to the scheme")
	if err = templatev1.AddToScheme(r.Scheme); err != nil {
		return ctrl.Result{}, err
	}

	// Look for the template to instantiate
	reqLogger.Info("Checking template availability", "Template name", instance.Spec.TemplateName)
	templateSpec := &templatev1.Template{}
	if err = r.Get(context, types.NamespacedName{Name: instance.Spec.TemplateName, Namespace: request.Namespace}, templateSpec); err != nil {
		reqLogger.Info("Template not available", "Name", instance.Spec.TemplateName, "Getting template URL", instance.Spec.TemplateURL)
		resp, err := http.Get(instance.Spec.TemplateURL)
		if err != nil {
			return ctrl.Result{}, err
		}
		reqLogger.Info("Retrieving data", "from URL", instance.Spec.TemplateURL)
		data, err := ioutil.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return ctrl.Result{}, err
		}
		reqLogger.Info("Unmarshaling yaml template content", "data", string(data))
		err = yaml.Unmarshal(data, &templateSpec)
		if err != nil {
			return ctrl.Result{}, err
		}
		reqLogger.Info("Unmarshaled yaml object", "templateSpec", templateSpec)
	}
	reqLogger.Info("Reconciling template instance", "Template content", templateSpec)
	secret, templateInstance := newTemplateInstanceForCR(instance, templateSpec)
	reqLogger.Info("Setting HPE5gcsApp instance as the owner and controller of both template instance and secret")
	if err = controllerutil.SetControllerReference(instance, templateInstance, r.Scheme); err != nil {
		reqLogger.Info("Failed at setting ownership to the controller", "Template instance", templateInstance.Name, "Error", err)
		return ctrl.Result{}, err
	}
	if err = controllerutil.SetControllerReference(instance, secret, r.Scheme); err != nil {
		reqLogger.Info("Failed at setting ownership to the controller", "Secret", secret.Name, "Error", err)
		return ctrl.Result{}, err
	}

	// Status update function
	updateStatus := func(ready bool, feedback string) {
		instance.Status.Feedback = feedback
		instance.Status.Ready = ready
		err := r.Status().Update(context, instance)
		if err != nil {
			reqLogger.Info("Cannot update status", "Status", feedback, "Error", err)
		}
	}

	// Check if the template instance already exists
	err = r.Get(context, types.NamespacedName{Name: templateInstance.Name, Namespace: templateInstance.Namespace}, templateInstance)
	if err != nil && errors.IsNotFound(err) {
		// Template instance does not exist - create it
		// Check if the secret already exists
		err = r.Get(context, types.NamespacedName{Name: secret.Name, Namespace: secret.Namespace}, secret)
		if err != nil && errors.IsNotFound(err) {
			reqLogger.Info("Creating a new secret", "Name", secret.Name)
			err = r.Create(context, secret)
			if err != nil {
				reqLogger.Info("Failed at creating", "Secret", secret.Name, "Error", err)
				return ctrl.Result{}, err
			}
		}
		reqLogger.Info("Creating the template instance", "Name", templateInstance.Name)
		err = r.Create(context, templateInstance)
		if err != nil {
			reqLogger.Info("Failed at creating", "Template instance", templateInstance.Name, "Error", err)
			return ctrl.Result{}, err
		}

		updateStatus(false, "Template instantiation started")
		// In progress, requeue
		return ctrl.Result{Requeue: true}, nil
	} else if err != nil {
		reqLogger.Info("Cannot create", "Template instance", instance.Spec.TemplateName, "Error", err)
		return ctrl.Result{}, err
	}

	// Template instance already exists - check status
	reqLogger.Info("Template instance already exists, checking status", "templateInstance.Namespace", templateInstance.Namespace, "templateInstance.Name", templateInstance.Name)
	for _, cond := range templateInstance.Status.Conditions {
		updateStatus(cond.Type == templatev1.TemplateInstanceReady && cond.Status == corev1.ConditionTrue, cond.Reason+": "+cond.Message)
		if cond.Type == templatev1.TemplateInstanceInstantiateFailure && cond.Status == corev1.ConditionTrue {
			// Instantiation failure: this may happen during the deletion of a previous instance. This is transient and should not be considered as an error
			// In this case, the message mentions "object is being deleted"
			if strings.Contains(cond.Message, "object is being deleted") {
				reqLogger.Info("Previous instance deletion in progress", "Template instance", instance.Spec.TemplateName, "Reason", cond.Reason, "Message", cond.Message)
				// Delete the failed instance, ignoring errors
				r.Delete(context, templateInstance)
				return ctrl.Result{Requeue: true}, nil
			}
			reqLogger.Info("Instantiation failure", "Template instance", instance.Spec.TemplateName, "Reason", cond.Reason, "Message", cond.Message)
			return ctrl.Result{}, err
		}
		if cond.Type == templatev1.TemplateInstanceReady && cond.Status == corev1.ConditionTrue {
			// Template instance already exists with ready status - don't requeue
			reqLogger.Info("Instantiation succeeded", "Template instance", instance.Spec.TemplateName, "Reason", cond.Reason, "Message", cond.Message)
			return ctrl.Result{}, nil
		}
		// In progress, requeue
		reqLogger.Info("Instantiation in progress", "Template instance", instance.Spec.TemplateName, "Reason", cond.Reason, "Message", cond.Message)
		return ctrl.Result{Requeue: true}, nil
	}
	return ctrl.Result{Requeue: true}, nil
}

// newTemplateInstanceForCR returns a template instance from the template parameter
func newTemplateInstanceForCR(cr *cmshpecomv1alpha1.HPE5gcsApp, template *templatev1.Template) (*corev1.Secret, *templatev1.TemplateInstance) {
	labels := map[string]string{
		"app": cr.Name,
	}
	secret := corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      cr.Name,
			Namespace: cr.Namespace,
		},
		StringData: map[string]string{
			"NAME": cr.Name,
		},
	}
	return &secret, &templatev1.TemplateInstance{
		ObjectMeta: metav1.ObjectMeta{
			Name:      cr.Name,
			Namespace: cr.Namespace,
			Labels:    labels,
		},
		Spec: templatev1.TemplateInstanceSpec{
			Template: *template,
			Secret: &corev1.LocalObjectReference{
				Name: secret.Name,
			},
		},
	}
}

// SetupWithManager sets up the controller with the Manager.
func (r *HPE5gcsAppReconciler) SetupWithManager(mgr ctrl.Manager) error {
	if err := templatev1.AddToScheme(r.Scheme); err != nil {
		return err
	}

	return ctrl.NewControllerManagedBy(mgr).
		For(&cmshpecomv1alpha1.HPE5gcsApp{}).
		Owns(&templatev1.TemplateInstance{}).
		Owns(&corev1.Secret{}).
		Complete(r)
}
